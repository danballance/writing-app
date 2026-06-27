import { DocumentEditor } from "./DocumentEditor";
import { DocumentHeader } from "./DocumentHeader";
import type { WritingEditor } from "../editor/schema";

type EditorWorkspaceProps = {
  editor: WritingEditor;
  onOpenContext: () => void;
  onOpenNavigation: () => void;
  onGenerateIdeas: () => void;
  onEditorChange: () => void;
  onEditorSelectionChange: () => void;
};

export function EditorWorkspace({
  editor,
  onOpenContext,
  onOpenNavigation,
  onGenerateIdeas,
  onEditorChange,
  onEditorSelectionChange,
}: EditorWorkspaceProps) {
  return (
    <section aria-label="Draft workspace" className="flex min-h-0 min-w-0 flex-col bg-white">
      <DocumentHeader
        onOpenContext={onOpenContext}
        onOpenNavigation={onOpenNavigation}
        onGenerateIdeas={onGenerateIdeas}
      />
      <DocumentEditor
        editor={editor}
        onChange={onEditorChange}
        onSelectionChange={onEditorSelectionChange}
      />
    </section>
  );
}
