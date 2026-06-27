import { useEffect, useId, useState } from "react";

let mermaidInitialized = false;
let mermaidModule: Promise<typeof import("mermaid")> | undefined;

type MermaidDiagramProps = {
  source: string;
  title: string;
  description: string;
};

export function MermaidDiagram({
  source,
  title,
  description,
}: MermaidDiagramProps) {
  const reactId = useId();
  const [svg, setSvg] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const render = async () => {
      try {
        mermaidModule ??= import("mermaid");
        const mermaid = (await mermaidModule).default;
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            suppressErrorRendering: true,
            mindmap: { useMaxWidth: true },
          });
          mermaidInitialized = true;
        }
        const id = `writing-partner-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
        const result = await mermaid.render(id, source);
        if (active) {
          setSvg(result.svg);
          setFailed(false);
        }
      } catch {
        if (active) {
          setSvg(undefined);
          setFailed(true);
        }
      }
    };

    void render();
    return () => {
      active = false;
    };
  }, [reactId, source]);

  if (failed) {
    return (
      <div
        role="status"
        className="rounded-xl border border-dashed border-[#c9c5dc] bg-white/60 px-5 py-8 text-center"
      >
        <p className="text-sm font-semibold text-[#393844]">Diagram unavailable</p>
        <p className="mt-1 text-xs leading-5 text-[#777386]">{description}</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        role="status"
        className="grid min-h-56 place-items-center rounded-xl bg-white/55 text-sm text-[#777386]"
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${title}. ${description}`}
      className="mermaid-diagram overflow-auto rounded-xl border border-[#d7d4e8] bg-white p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
