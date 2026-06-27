import type {
  AgentContextSource,
  SuggestionEvent,
  SuggestionFeed,
  SuggestionItem,
  TextSuggestion,
} from "./types";

function createInitialSuggestions(
  sourceLabels: string[],
  createdAt: number,
): SuggestionItem[] {
  return [
    {
      id: "snippet-human-centred",
      dedupeKey: "snippet-human-centred",
      kind: "snippet",
      title: "Bring the human role forward",
      summary:
        "Frame collaboration as the transition from delegation to shared judgement.",
      body:
        "The strongest distinction in the draft is not between human and machine output, but between delegation and shared judgement. Bringing that contrast forward would make the argument feel more concrete.",
      insertText:
        "The meaningful shift is not from human work to machine work, but from delegation to shared judgement.",
      sourceLabels: [sourceLabels[1] ?? "Internal Product Vision"],
      createdAt,
    },
    {
      id: "fact-adoption",
      dedupeKey: "fact-adoption-pattern",
      kind: "fact",
      title: "Adoption follows workflow fit",
      summary:
        "Your research links successful adoption to fitting existing creative routines.",
      body:
        "The market research consistently describes workflow fit—not raw capability—as the strongest predictor of whether teams continue using an AI writing tool after trial.",
      insertText:
        "Adoption depends less on raw model capability than on how naturally assistance fits an existing creative workflow.",
      sourceLabels: [sourceLabels[0] ?? "Market Trends 2024"],
      createdAt: createdAt + 1,
    },
    {
      id: "term-cognitive-partnership",
      dedupeKey: "term-cognitive-partnership",
      kind: "term",
      title: "Cognitive partnership",
      summary:
        "A useful term for assistance that contributes without taking authorship away.",
      body:
        "Use “cognitive partnership” when describing an AI system that supplies options, evidence, and structure while leaving editorial judgement with the writer.",
      insertText:
        "This is better understood as cognitive partnership: assistance that expands the writer’s options without assuming authorship.",
      sourceLabels: [sourceLabels[1] ?? "Internal Product Vision"],
      createdAt: createdAt + 2,
    },
    {
      id: "outline-trust",
      dedupeKey: "outline-trust-arc",
      kind: "outline",
      title: "A trust-first argument",
      summary:
        "Move from the limits of automation to evidence, control, and collaboration.",
      body:
        "This sequence makes the reader’s likely trust concerns the organizing principle of the article.",
      sourceLabels: [],
      createdAt: createdAt + 3,
      nodes: [
        {
          id: "outline-1",
          label: "1. The limitation",
          detail: "Why opaque automation breaks creative trust.",
        },
        {
          id: "outline-2",
          label: "2. The alternative",
          detail: "Contextual assistance with visible sources and user control.",
        },
        {
          id: "outline-3",
          label: "3. The outcome",
          detail: "A collaborative workflow that compounds human judgement.",
        },
      ],
    },
    {
      id: "layout-contrast",
      dedupeKey: "layout-contrast-framework",
      kind: "layout",
      title: "Contrast framework",
      summary:
        "Pair each legacy AI behaviour with the collaborative behaviour replacing it.",
      body:
        "A repeated old/new contrast would give the middle of the document a clear rhythm without forcing a rigid outline.",
      sourceLabels: [],
      createdAt: createdAt + 4,
      nodes: [
        {
          id: "layout-1",
          label: "Opaque answers → visible context",
        },
        {
          id: "layout-2",
          label: "One-shot generation → iterative options",
        },
        {
          id: "layout-3",
          label: "Automation → augmentation",
        },
      ],
    },
    {
      id: "map-collaboration",
      dedupeKey: "map-collaboration-model",
      kind: "mindMap",
      title: "Collaboration model",
      summary:
        "A map connecting context, suggestions, writer control, and the evolving draft.",
      body:
        "Use this as a thinking aid for the relationships your article needs to explain.",
      sourceLabels: [sourceLabels[1] ?? "Internal Product Vision"],
      createdAt: createdAt + 5,
      accessibleDescription:
        "A mind map with human judgement at the centre, connected to project context, agent suggestions, editorial control, and the evolving document.",
      mermaidSource: `mindmap
  root((Human judgement))
    Project context
      Facts
      Terminology
    Agent suggestions
      Snippets
      Structure
    Editorial control
      Preview
      Accept or cancel
    Evolving document`,
    },
  ];
}

export function createMockSuggestionFeed(
  context: AgentContextSource,
): SuggestionFeed {
  const listeners = new Set<(event: SuggestionEvent) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let stopDocumentSubscription: (() => void) | undefined;
  let documentTimer: ReturnType<typeof setTimeout> | undefined;
  let steeringSequence = 0;

  const emit = (event: SuggestionEvent) => {
    listeners.forEach((listener) => listener(event));
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const sourceLabels = context
    .getArtifactReferences()
    .map((artifact) => artifact.title);

  const start = () => {
    emit({ type: "agent.status", status: "working" });
    schedule(() => {
      const initial = createInitialSuggestions(sourceLabels, Date.now());
      initial.forEach((item) => emit({ type: "suggestion.added", item }));
      emit({ type: "agent.status", status: "idle" });
    }, 300);

    schedule(() => {
      const updated = createInitialSuggestions(sourceLabels, Date.now()).find(
        (item) => item.id === "snippet-human-centred",
      );
      if (updated) {
        emit({
          type: "suggestion.updated",
          item: {
            ...updated,
            summary:
              "A sharper opening contrast: delegated output versus shared judgement.",
          },
        });
      }
    }, 3_500);

    schedule(
      () => emit({ type: "suggestion.retracted", id: "layout-contrast" }),
      8_000,
    );

    stopDocumentSubscription = context.subscribeToDocument((snapshot) => {
      if (documentTimer) {
        clearTimeout(documentTimer);
      }
      documentTimer = setTimeout(() => {
        const paragraphCount = snapshot.blocks.filter(
          (block) => block.type === "paragraph" && block.text.trim(),
        ).length;
        const item: TextSuggestion = {
          id: `document-observation-${snapshot.revision}`,
          dedupeKey: `document-observation-${snapshot.revision}`,
          kind: "snippet",
          title: "The draft is developing a clear cadence",
          summary: `The accepted draft now has ${paragraphCount} developed paragraph${paragraphCount === 1 ? "" : "s"}.`,
          body:
            "The argument is beginning to alternate between conceptual claims and practical implications. Continuing that cadence could keep the piece grounded.",
          insertText:
            "In practice, this means the interface must support reflection as deliberately as it supports generation.",
          sourceLabels: [],
          createdAt: Date.now(),
        };
        emit({ type: "suggestion.added", item });
      }, 1_600);
    });
  };

  const stop = () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    if (documentTimer) {
      clearTimeout(documentTimer);
      documentTimer = undefined;
    }
    stopDocumentSubscription?.();
    stopDocumentSubscription = undefined;
  };

  return {
    subscribe(listener) {
      const shouldStart = listeners.size === 0;
      listeners.add(listener);
      if (shouldStart) {
        start();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop();
        }
      };
    },
    async sendSteering(prompt) {
      const cleanPrompt = prompt.trim();
      if (!cleanPrompt) {
        throw new Error("Enter a direction for the writing partner.");
      }

      steeringSequence += 1;
      const sequence = steeringSequence;
      emit({ type: "agent.status", status: "working" });
      schedule(() => {
        const item: TextSuggestion = {
          id: `steering-${sequence}`,
          dedupeKey: `steering-${sequence}-${cleanPrompt.toLowerCase()}`,
          kind: "snippet",
          title: "A response to your direction",
          summary: cleanPrompt,
          body: `The agent considered “${cleanPrompt}” alongside the accepted document and found a concise way to carry that direction into the argument.`,
          insertText: `A useful way to express this is to treat ${cleanPrompt.toLowerCase()} as an editorial constraint rather than a generation target.`,
          sourceLabels: sourceLabels.slice(0, 1),
          createdAt: Date.now(),
        };
        emit({ type: "suggestion.added", item });
        emit({ type: "agent.status", status: "idle" });
      }, 650);
    },
    async retry() {
      emit({ type: "agent.status", status: "working" });
      schedule(() => emit({ type: "agent.status", status: "idle" }), 500);
    },
  };
}
