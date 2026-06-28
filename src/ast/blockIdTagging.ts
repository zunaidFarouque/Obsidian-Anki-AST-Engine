import type { Content, Heading, Root, Text, Paragraph } from "mdast";
import type { Node, Parent } from "unist";
import { isObsidianEmbed } from "./obsidianLinks";

const BLOCK_ID_PATTERN = /\s+\^([a-zA-Z0-9-]+)\s*$/;
const STANDALONE_BLOCK_ID_PATTERN = /^\^([a-zA-Z0-9-]+)\s*$/;

export type BlockCacheEntry = {
  id: string;
  nodeIndex: number;
};

export function stripBlockIdSuffix(value: string): {
  text: string;
  blockId?: string;
} {
  const match = value.match(BLOCK_ID_PATTERN);
  if (!match?.[1]) {
    return { text: value };
  }

  return {
    text: value.slice(0, match.index).trimEnd(),
    blockId: match[1],
  };
}

export function buildBlockIndex(ast: Root): BlockCacheEntry[] {
  const entries: BlockCacheEntry[] = [];

  ast.children.forEach((node, index) => {
    if (isBlockContainer(node)) {
      const inlineId = getInlineBlockId(node as Content & Parent);
      if (inlineId) {
        entries.push({ id: inlineId, nodeIndex: index });
        return;
      }
    }

    if (node.type === "list" || node.type === "blockquote") {
      const standaloneId = getStandaloneBlockIdAfter(ast, index);
      if (standaloneId) {
        entries.push({ id: standaloneId, nodeIndex: index });
      }
      return;
    }

    if (isStandaloneBlockIdParagraph(node) && index > 0) {
      const text = node.children
        .map((child) => ("value" in child ? String(child.value) : ""))
        .join("")
        .trim();
      if (!STANDALONE_BLOCK_ID_PATTERN.test(text)) {
        return;
      }

      const blockId = getStandaloneBlockIdFromParagraph(node);
      if (blockId) {
        entries.push({ id: blockId, nodeIndex: index - 1 });
      }
    }
  });

  return entries;
}

export function findBlockById(ast: Root, blockId: string): Content[] | null {
  const entry = buildBlockIndex(ast).find((item) => item.id === blockId);
  if (!entry) {
    return null;
  }

  const node = ast.children[entry.nodeIndex];
  if (!node) {
    return null;
  }

  if (isObsidianEmbed(node)) {
    return [structuredClone(node) as Content];
  }

  if (isBlockContainer(node)) {
    return cloneBlockContent(node as Content & Parent);
  }

  return null;
}

export function extractHeadingSection(
  ast: Root,
  headingText: string,
): Content[] | null {
  const normalizedTarget = headingText.trim().toLowerCase();
  let startIndex = -1;
  let startDepth = 0;

  for (let index = 0; index < ast.children.length; index += 1) {
    const node = ast.children[index];
    if (node?.type !== "heading") {
      continue;
    }

    const heading = node as Heading;
    const text = heading.children
      .map((child) => ("value" in child ? String(child.value) : ""))
      .join("")
      .trim()
      .toLowerCase();

    if (text === normalizedTarget) {
      startIndex = index + 1;
      startDepth = heading.depth;
      break;
    }
  }

  if (startIndex === -1) {
    return null;
  }

  const section: Content[] = [];
  for (let index = startIndex; index < ast.children.length; index += 1) {
    const node = ast.children[index];
    if (!node) {
      continue;
    }

    if (node.type === "heading") {
      const depth = (node as Heading).depth;
      if (depth <= startDepth) {
        break;
      }
    }

    section.push(structuredClone(node) as Content);
  }

  return section.length > 0 ? section : null;
}

function getInlineBlockId(node: Content & Parent): string | undefined {
  const lastChild = node.children[node.children.length - 1];
  if (!lastChild || lastChild.type !== "text") {
    return undefined;
  }

  const { blockId } = stripBlockIdSuffix((lastChild as Text).value);
  return blockId;
}

function getStandaloneBlockIdAfter(
  ast: Root,
  blockIndex: number,
): string | undefined {
  const node = ast.children[blockIndex];
  if (!node || (node.type !== "list" && node.type !== "blockquote")) {
    return undefined;
  }

  for (let index = blockIndex + 1; index < ast.children.length; index += 1) {
    const sibling = ast.children[index];
    if (!sibling) {
      continue;
    }

    if (isStandaloneBlockIdParagraph(sibling)) {
      return getStandaloneBlockIdFromParagraph(sibling);
    }

    break;
  }

  return undefined;
}

function isStandaloneBlockIdParagraph(node: Content): node is Paragraph {
  return node.type === "paragraph";
}

function getStandaloneBlockIdFromParagraph(node: Paragraph): string | undefined {
  const text = node.children
    .map((child) => ("value" in child ? String(child.value) : ""))
    .join("")
    .trim();

  return text.match(STANDALONE_BLOCK_ID_PATTERN)?.[1];
}

function isBlockContainer(node: Node): node is Content & Parent {
  if (node.type === "root") {
    return false;
  }

  return (
    node.type === "paragraph" ||
    node.type === "heading" ||
    node.type === "blockquote" ||
    node.type === "list"
  );
}

function cloneBlockContent(node: Content & Parent): Content[] {
  const cloned = structuredClone(node) as Content & Parent;
  const lastChild = cloned.children[cloned.children.length - 1];

  if (lastChild?.type === "text") {
    const textChild = lastChild as Text;
    const { text } = stripBlockIdSuffix(textChild.value);
    if (text.length === 0) {
      cloned.children.pop();
    } else {
      textChild.value = text;
    }
  }

  if (cloned.type === "paragraph") {
    return cloned.children.length > 0 ? [cloned] : [];
  }

  return [cloned as Content];
}
