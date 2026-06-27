import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAgentContextSource } from "./contextSource";
import { createMockSuggestionFeed } from "./mockSuggestionFeed";
import type { SuggestionEvent } from "./types";

describe("mock suggestion feed", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits proactively and accepts steering through the same event channel", async () => {
    const context = createAgentContextSource([
      { id: "source", title: "Source.pdf", kind: "pdf" },
    ]);
    const feed = createMockSuggestionFeed(context);
    const events: SuggestionEvent[] = [];
    const unsubscribe = feed.subscribe((event) => events.push(event));

    await vi.advanceTimersByTimeAsync(301);
    expect(events.filter((event) => event.type === "suggestion.added")).toHaveLength(6);

    await feed.sendSteering("Emphasise trust");
    await vi.advanceTimersByTimeAsync(651);
    expect(
      events.some(
        (event) =>
          event.type === "suggestion.added" &&
          event.item.id.startsWith("steering-"),
      ),
    ).toBe(true);

    context.updateDocument([{ id: "p", type: "paragraph", text: "New text" }]);
    await vi.advanceTimersByTimeAsync(1_601);
    expect(
      events.some(
        (event) =>
          event.type === "suggestion.added" &&
          event.item.id.startsWith("document-observation-"),
      ),
    ).toBe(true);

    const eventCount = events.length;
    unsubscribe();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(events).toHaveLength(eventCount);
  });
});
