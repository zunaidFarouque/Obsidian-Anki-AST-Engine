import type { Content, Root } from "mdast";
import type { Plugin } from "unified";
import { visitParents } from "unist-util-visit-parents";

const COMMENT_PAIR = /%%[\s\S]*?%%/g;

const CODE_LIKE_TYPES = new Set(["code", "inlineCode", "math"]);

function isCodeLikeAncestor(ancestors: Content[]): boolean {
  return ancestors.some((node) => CODE_LIKE_TYPES.has(node.type));
}

export function stripObsidianCommentsFromText(value: string): string {
  return value.replace(COMMENT_PAIR, "");
}

function nodeContainsCommentMarker(node: Content): boolean {
  if (node.type === "code") {
    return false;
  }

  if ("value" in node && typeof node.value === "string" && node.value.includes("%%")) {
    return true;
  }

  if ("children" in node && Array.isArray(node.children)) {
    return node.children.some((child) => nodeContainsCommentMarker(child as Content));
  }

  return false;
}

function flattenBlockText(node: Content): string {
  if (node.type === "code") {
    return node.value;
  }

  if (!("children" in node) || !Array.isArray(node.children)) {
    return "";
  }

  return node.children
    .map((child) => ("value" in child ? String(child.value) : ""))
    .join("");
}

function setBlockText(node: Content, value: string): Content | undefined {
  if (node.type === "paragraph") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    return {
      ...node,
      children: [{ type: "text", value: trimmed }],
    };
  }

  return node;
}

function stripInlineCommentsFromTree(tree: Root): void {
  visitParents(tree, "text", (node, ancestors) => {
    if (isCodeLikeAncestor(ancestors as Content[])) {
      return;
    }

    node.value = stripObsidianCommentsFromText(node.value);
  });
}

function stripBlockCommentsFromChildren(children: Content[]): Content[] {
  const result: Content[] = [];
  let inComment = false;

  for (const child of children) {
    if (child.type === "code") {
      result.push(child);
      continue;
    }

    if (inComment) {
      const text = flattenBlockText(child);
      const closeIndex = text.indexOf("%%");
      if (closeIndex === -1) {
        continue;
      }

      inComment = false;
      const after = text.slice(closeIndex + 2).trim();
      if (after.length > 0) {
        const kept = setBlockText(child, after);
        if (kept) {
          result.push(kept);
        }
      }
      continue;
    }

    if (!nodeContainsCommentMarker(child)) {
      if (!isEmptyParagraph(child)) {
        result.push(child);
      }
      continue;
    }

    const text = stripObsidianCommentsFromText(flattenBlockText(child));
    const openIndex = text.indexOf("%%");
    if (openIndex === -1) {
      if (text.trim().length === 0) {
        continue;
      }

      const kept = setBlockText(child, text);
      if (kept) {
        result.push(kept);
      }
      continue;
    }

    const closeIndex = text.indexOf("%%", openIndex + 2);
    if (closeIndex !== -1) {
      const kept = setBlockText(child, text);
      if (kept) {
        result.push(kept);
      }
      continue;
    }

    inComment = true;
    const before = text.slice(0, openIndex).trim();
    if (before.length > 0) {
      const kept = setBlockText(child, before);
      if (kept) {
        result.push(kept);
      }
    }
  }

  return result;
}

function isEmptyParagraph(node: Content): boolean {
  if (node.type !== "paragraph") {
    return false;
  }

  if (node.children.length === 0) {
    return true;
  }

  if (node.children.some((child) => child.type !== "text")) {
    return false;
  }

  return flattenBlockText(node).trim().length === 0;
}

function stripCommentsFromContainer(node: Content): Content {
  if (!("children" in node) || !Array.isArray(node.children)) {
    return node;
  }

  return {
    ...node,
    children: stripBlockCommentsFromChildren(
      node.children as Content[],
    ) as unknown as typeof node.children,
  } as Content;
}

export function stripObsidianCommentsFromNodes(nodes: Content[]): Content[] {
  const root: Root = { type: "root", children: nodes };
  stripInlineCommentsFromTree(root);

  const stripped = stripBlockCommentsFromChildren(root.children).map((child) => {
    if (child.type === "blockquote" || child.type === "listItem") {
      return stripCommentsFromContainer(child);
    }

    return child;
  });

  return stripped.filter((child) => !isEmptyParagraph(child));
}

export const remarkObsidianComment: Plugin<[], Root> = () => {
  return (tree) => {
    tree.children = stripObsidianCommentsFromNodes(tree.children);
  };
};
