import type { Blockquote, Paragraph, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const CALLOUT_RE = /^\[!([a-zA-Z-]+)\](?:\s+(.*))?$/;

export type ObsidianCallout = {
  type: "obsidianCallout";
  calloutType: string;
  title?: string;
  children: Blockquote["children"];
};

function getParagraphText(paragraph: Paragraph): string {
  return paragraph.children
    .filter((child): child is Text => child.type === "text")
    .map((child) => child.value)
    .join("");
}

function parseCalloutBlockquote(blockquote: Blockquote): ObsidianCallout | null {
  const firstChild = blockquote.children[0];
  if (!firstChild || firstChild.type !== "paragraph") {
    return null;
  }

  const lines = getParagraphText(firstChild as Paragraph).split(/\r?\n/);
  const match = lines[0]?.match(CALLOUT_RE);
  if (!match) {
    return null;
  }

  const children: Blockquote["children"] = [];
  const remainingFirstParagraph = lines.slice(1).join("\n").trim();
  if (remainingFirstParagraph.length > 0) {
    children.push({
      type: "paragraph",
      children: [{ type: "text", value: remainingFirstParagraph }],
    });
  }
  children.push(...blockquote.children.slice(1));

  return {
    type: "obsidianCallout",
    calloutType: match[1]!,
    title: match[2]?.trim() || undefined,
    children,
  };
}

export const remarkObsidianCallout: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "blockquote", (node, index, parent) => {
      if (!parent || index === undefined) {
        return;
      }

      const callout = parseCalloutBlockquote(node as Blockquote);
      if (!callout) {
        return;
      }

      parent.children[index] = callout as unknown as Blockquote;
    });
  };
};
