import type { DocumentSnapshot } from "../suggestions/types";
import type { WritingBlock, WritingEditor } from "./schema";

function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(contentToText).join("");
  }
  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>;
    if (typeof record.text === "string") {
      return record.text;
    }
    return contentToText(record.content);
  }
  return "";
}

function flattenAcceptedBlocks(blocks: WritingBlock[]): DocumentSnapshot["blocks"] {
  return blocks.flatMap((block) => {
    const current =
      block.type === "suggestionPreview"
        ? []
        : [
            {
              id: block.id,
              type: block.type,
              text: contentToText(block.content),
            },
          ];
    return [...current, ...flattenAcceptedBlocks(block.children)];
  });
}

export function getAcceptedDocumentBlocks(editor: WritingEditor) {
  return flattenAcceptedBlocks(editor.document);
}
