import { describe, expect, it } from "vitest";

import { inboxReducer, initialInboxState } from "./inbox";
import type { TextSuggestion } from "./types";

function suggestion(index: number, dedupeKey = `item-${index}`): TextSuggestion {
  return {
    id: `item-${index}`,
    dedupeKey,
    kind: "snippet",
    title: `Suggestion ${index}`,
    summary: "Summary",
    body: "Body",
    insertText: "Insert text",
    sourceLabels: [],
    createdAt: index,
  };
}

describe("suggestion inbox reducer", () => {
  it("deduplicates and limits the session queue", () => {
    let state = initialInboxState;
    for (let index = 0; index < 31; index += 1) {
      state = inboxReducer(state, {
        type: "event",
        event: { type: "suggestion.added", item: suggestion(index) },
      });
    }
    state = inboxReducer(state, {
      type: "event",
      event: {
        type: "suggestion.added",
        item: suggestion(99, "item-30"),
      },
    });

    expect(state.entries).toHaveLength(30);
    expect(state.entries.some((entry) => entry.item.id === "item-0")).toBe(false);
    expect(state.entries.some((entry) => entry.item.id === "item-99")).toBe(false);
  });

  it("preserves a preview while updates and retractions mark it stale", () => {
    const original = suggestion(1);
    let state = inboxReducer(initialInboxState, {
      type: "event",
      event: { type: "suggestion.added", item: original },
    });
    state = inboxReducer(state, { type: "select", id: original.id });
    state = inboxReducer(state, { type: "preview.started", id: original.id });
    state = inboxReducer(state, {
      type: "event",
      event: {
        type: "suggestion.updated",
        item: { ...original, title: "Refined suggestion" },
      },
    });
    state = inboxReducer(state, {
      type: "event",
      event: { type: "suggestion.retracted", id: original.id },
    });

    expect(state.entries[0]).toMatchObject({ stale: true, withdrawn: true });
    expect(state.entries[0]?.item.title).toBe("Refined suggestion");

    state = inboxReducer(state, {
      type: "preview.resolved",
      id: original.id,
      outcome: "cancelled",
    });
    expect(state.entries).toHaveLength(0);
  });
});
