import type { Heading, Paragraph, PhrasingContent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const PREVIEW_HEADING_RE = /^:\s+(#{1,6})\s+(.+)$/;

export const remarkPreviewHeading: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "paragraph", (node, index, parent) => {
      if (!parent || index === undefined) {
        return;
      }

      const paragraph = node as Paragraph;
      if (paragraph.children.some((child) => child.type !== "text")) {
        return;
      }

      const text = paragraph.children
        .filter((child): child is Text => child.type === "text")
        .map((child) => child.value)
        .join("");

      const match = text.match(PREVIEW_HEADING_RE);
      if (!match) {
        return;
      }

      const depth = match[1]!.length as Heading["depth"];
      const heading: Heading = {
        type: "heading",
        depth,
        children: [{ type: "text", value: match[2]!.trim() }],
      };

      parent.children[index] = heading;
    });
  };
};
