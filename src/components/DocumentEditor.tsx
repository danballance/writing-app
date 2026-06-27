import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";

import type { WritingEditor } from "../editor/schema";

type DocumentEditorProps = {
  editor: WritingEditor;
  onChange: () => void;
  onSelectionChange: () => void;
};

export function DocumentEditor({
  editor,
  onChange,
  onSelectionChange,
}: DocumentEditorProps) {
  return (
    <section
      aria-label="Document editor"
      className="min-h-0 flex-1 overflow-y-auto bg-white px-0 py-10 lg:py-14"
    >
      <div className="mx-auto min-h-full w-full max-w-[55rem]">
        <BlockNoteView
          editor={editor}
          theme="light"
          aria-label="Editable draft content"
          data-editor-surface
          onChange={onChange}
          onSelectionChange={onSelectionChange}
        />
      </div>
    </section>
  );
}
