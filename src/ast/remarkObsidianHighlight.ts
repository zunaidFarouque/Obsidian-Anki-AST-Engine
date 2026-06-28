import type { PhrasingContent, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const HIGHLIGHT_PATTERN = /==([^=\n]+)==/g;

function containsHighlight(value: string): boolean {
  return value.includes("==");
}

function splitHighlightText(value: string): PhrasingContent[] {
  const parts: PhrasingContent[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(HIGHLIGHT_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ type: "text", value: value.slice(lastIndex, start) });
    }
    parts.push({
      type: "obsidianHighlight",
      children: [{ type: "text", value: match[1]! }],
    } as unknown as PhrasingContent);
    lastIndex = start + match[0].length;
  }

  if (lastIndex < value.length) {
    parts.push({ type: "text", value: value.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value }];
}

export const remarkObsidianHighlight: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || index === undefined || !containsHighlight(node.value)) {
        return;
      }

      const parts = splitHighlightText(node.value);
      if (parts.length === 1 && parts[0]?.type === "text") {
        return;
      }

      parent.children.splice(index, 1, ...parts);
    });
  };
};
