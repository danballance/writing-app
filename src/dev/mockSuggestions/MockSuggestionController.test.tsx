import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockSuggestionController } from "./MockSuggestionController";

describe("MockSuggestionController", () => {
  it("switches kind-specific fields and persists a validated suggestion", async () => {
    const user = userEvent.setup();
    const createSuggestion = vi.fn().mockResolvedValue({ accepted: true });
    render(
      <MockSuggestionController createSuggestion={createSuggestion} />,
    );

    expect(screen.getByLabelText("Insert text")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Kind"), "outline");
    expect(screen.queryByLabelText("Insert text")).toBeNull();
    expect(screen.getByLabelText("Nodes JSON")).toBeTruthy();

    await user.type(screen.getByLabelText("Title"), "Manual outline");
    await user.type(screen.getByLabelText("Summary"), "A short outline summary");
    await user.type(screen.getByLabelText("Body"), "A longer outline body");
    await user.type(
      screen.getByLabelText(/Source labels/),
      "Source.pdf",
    );
    fireEvent.change(screen.getByLabelText("Nodes JSON"), {
      target: { value: '[{"id":"one","label":"First"}]' },
    });

    await user.click(screen.getByRole("button", { name: "Send suggestion" }));

    expect(createSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "outline",
        title: "Manual outline",
        sourceLabels: ["Source.pdf"],
        nodes: [{ id: "one", label: "First" }],
      }),
    );
    expect(screen.getByRole("status").textContent).toContain("Manual outline");
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Kind") as HTMLSelectElement).value).toBe(
      "snippet",
    );

  });

  it("reports a rejected development injection", async () => {
    const user = userEvent.setup();
    const createSuggestion = vi.fn().mockResolvedValue({ accepted: false });
    render(
      <MockSuggestionController createSuggestion={createSuggestion} />,
    );

    await user.type(screen.getByLabelText("Title"), "Duplicate idea");
    await user.type(screen.getByLabelText("Summary"), "Already present");
    await user.type(screen.getByLabelText("Body"), "Longer duplicate body");
    await user.type(screen.getByLabelText("Insert text"), "Duplicate text");
    await user.click(screen.getByRole("button", { name: "Send suggestion" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "rejected as a duplicate",
    );
  });

  it("disables repeat submission while Electron IPC is pending", async () => {
    const user = userEvent.setup();
    let resolveRequest!: (result: { accepted: boolean }) => void;
    const createSuggestion = vi.fn(
      () =>
        new Promise<{ accepted: boolean }>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    render(
      <MockSuggestionController createSuggestion={createSuggestion} />,
    );

    await user.type(screen.getByLabelText("Title"), "Pending idea");
    await user.type(screen.getByLabelText("Summary"), "Pending summary");
    await user.type(screen.getByLabelText("Body"), "Pending body");
    await user.type(screen.getByLabelText("Insert text"), "Pending text");
    await user.click(screen.getByRole("button", { name: "Send suggestion" }));

    const pendingButton = screen.getByRole("button", { name: "Sending…" });
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true);
    resolveRequest({ accepted: true });
    expect(await screen.findByRole("status")).toBeTruthy();
  });
});
