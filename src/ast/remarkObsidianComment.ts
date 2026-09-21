import type { RootContent, Root } from "mdast";
import type { Plugin } from "unified";
import { visitParents } from "unist-util-visit-parents";

const COMMENT_PAIR = /%%[\s\S]*?%%/g;

const CODE_LIKE_TYPES = new Set(["code", "inlineCode", "math"]);

function isCodeLikeAncestor(ancestors: RootContent[]): boolean {
  return ancestors.some((node) => CODE_LIKE_TYPES.has(node.type));
}

export function stripObsidianCommentsFromText(value: string): string {
  return value.replace(COMMENT_PAIR, "");
}

function nodeContainsCommentMarker(node: RootContent): boolean {
  if (node.type === "code") {
    return false;
  }

  if ("value" in node && typeof node.value === "string" && node.value.includes("%%")) {
    return true;
  }

  if ("children" in node && Array.isArray(node.children)) {
    const parentNode = node as { children: RootContent[] };
    return parentNode.children.some((child) => nodeContainsCommentMarker(child));
  }

  return false;
}

function flattenBlockText(node: RootContent): string {
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

function setBlockText(node: RootContent, value: string): RootContent | undefined {
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
    if (isCodeLikeAncestor(ancestors as RootContent[])) {
      return;
    }

    node.value = stripObsidianCommentsFromText(node.value);
  });
}

function stripBlockCommentsFromChildren(children: RootContent[]): RootContent[] {
  const result: RootContent[] = [];
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

function isEmptyParagraph(node: RootContent): boolean {
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

function stripCommentsFromContainer(node: RootContent): RootContent {
  if (!("children" in node) || !Array.isArray(node.children)) {
    return node;
  }

  const parentNode = node as { children: RootContent[] };
  return {
    ...node,
    children: stripBlockCommentsFromChildren(
      parentNode.children,
    ),
  } as RootContent;
}

export function stripObsidianCommentsFromNodes(nodes: RootContent[]): RootContent[] {
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
