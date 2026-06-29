import type { Root, Paragraph, Text } from "mdast";
import type { Parent } from "unist";
import { visit } from "unist-util-visit";
import { parseLinktext } from "../obsidian/linkResolver";

export type ObsidianEmbed = {
  type: "obsidianEmbed";
  value: string;
  data: ReturnType<typeof parseLinktext>;
  children: [];
};

const WIKI_EMBED_PATTERN = /!\[\[([^\]]+)\]\]/g;

export function remarkObsidianLinks() {
  return (tree: Root) => {
    const replacements: Array<{
      parent: Parent;
      index: number;
      nodes: (Paragraph | ObsidianEmbed)[];
    }> = [];

    visit(tree, "paragraph", (node, index, parent) => {
      if (index === undefined || !parent) {
        return;
      }

      const paragraph = node as Paragraph;
      const nodes = extractEmbedsFromParagraph(paragraph);
      if (!nodes) {
        return;
      }

      replacements.push({ parent, index, nodes });
    });

    for (const replacement of replacements.reverse()) {
      replacement.parent.children.splice(
        replacement.index,
        1,
        ...(replacement.nodes as never[]),
      );
    }
  };
}

function extractEmbedsFromParagraph(
  paragraph: Paragraph,
): (Paragraph | ObsidianEmbed)[] | null {
  const fromWikiLink = extractBangWikiLinkEmbed(paragraph);
  if (fromWikiLink) {
    return fromWikiLink;
  }

  const fullText = paragraph.children
    .map((child) => ("value" in child ? String(child.value) : ""))
    .join("");

  if (!fullText.includes("![[")) {
    return null;
  }

  const nodes = splitParagraphEmbeds(fullText, paragraph.position);
  const hasEmbed = nodes.some((entry) => entry.type === "obsidianEmbed");
  return hasEmbed ? nodes : null;
}

function extractBangWikiLinkEmbed(
  paragraph: Paragraph,
): (Paragraph | ObsidianEmbed)[] | null {
  const nodes: (Paragraph | ObsidianEmbed)[] = [];
  let changed = false;
  const children = [...paragraph.children];

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const next = children[index + 1];
    const childType = (child as { type: string }).type;
    const nextType = (next as { type: string } | undefined)?.type;

    if (
      childType === "text" &&
      nextType === "wikiLink" &&
      (child as Text).value.endsWith("!")
    ) {
      const textChild = child as Text;
      const before = textChild.value.slice(0, -1);
      const wiki = next as { value: string };

      if (before.trim().length > 0) {
        nodes.push(createParagraph(before.trim(), paragraph.position));
      }

      nodes.push(createObsidianEmbed(wiki.value, paragraph.position));
      changed = true;
      index += 1;
      continue;
    }

    if (childType === "wikiLink") {
      nodes.push(createParagraph(`[[${(child as { value: string }).value}]]`, paragraph.position));
      continue;
    }

    if (childType === "text") {
      nodes.push(createParagraph((child as Text).value, paragraph.position));
    }
  }

  return changed ? nodes : null;
}

function splitParagraphEmbeds(
  fullText: string,
  position?: Paragraph["position"],
): (Paragraph | ObsidianEmbed)[] {
  const nodes: (Paragraph | ObsidianEmbed)[] = [];
  let lastIndex = 0;

  for (const match of fullText.matchAll(WIKI_EMBED_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const before = fullText.slice(lastIndex, start);

    if (before.trim().length > 0) {
      nodes.push(createParagraph(before.trim(), position));
    }

    nodes.push(createObsidianEmbed(match[1] ?? "", position));
    lastIndex = end;
  }

  const after = fullText.slice(lastIndex);
  if (after.trim().length > 0) {
    nodes.push(createParagraph(after.trim(), position));
  }

  return nodes.length > 0 ? nodes : [createParagraph(fullText, position)];
}

function createObsidianEmbed(
  linktext: string,
  position?: Paragraph["position"],
): ObsidianEmbed {
  return {
    type: "obsidianEmbed",
    value: linktext,
    data: parseLinktext(linktext, true),
    children: [],
    position,
  } as ObsidianEmbed;
}

function createParagraph(text: string, position?: Paragraph["position"]): Paragraph {
  return {
    type: "paragraph",
    children: [{ type: "text", value: text } as Text],
    position,
  };
}

export function isObsidianEmbed(node: unknown): node is ObsidianEmbed {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as { type: string }).type === "obsidianEmbed"
  );
}