import { describe, expect, it, vi } from "vitest";

import { createAgentContextSource } from "./contextSource";

describe("agent context source", () => {
  it("publishes only changed accepted document snapshots", () => {
    const source = createAgentContextSource([
      { id: "source", title: "Source.pdf", kind: "pdf" },
    ]);
    const listener = vi.fn();
    source.subscribeToDocument(listener);
    const blocks = [{ id: "a", type: "paragraph", text: "Draft" }];

    source.updateDocument(blocks);
    source.updateDocument(blocks);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(source.getDocumentSnapshot()).toEqual({ revision: 1, blocks });
    expect(source.getArtifactReferences()[0]?.title).toBe("Source.pdf");
  });
});
