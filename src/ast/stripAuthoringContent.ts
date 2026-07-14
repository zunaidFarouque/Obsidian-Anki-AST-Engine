import type { Content } from "mdast";
import { stripObsidianCommentsFromNodes } from "./remarkObsidianComment";

export const ANKI_ID_REGEX =
  /<!--\s*anki-id:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*-->/i;

export function isAnkiIdHtmlNode(node: Content): boolean {
  return (
    node.type === "html" &&
    "value" in node &&
    ANKI_ID_REGEX.test(String(node.value))
  );
}

export function isAuthoringHtmlNode(node: Content): boolean {
  return node.type === "html" && "value" in node && !isAnkiIdHtmlNode(node);
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

  const text = node.children
    .map((child) => ("value" in child ? String(child.value) : ""))
    .join("");

  return text.trim().length === 0;
}

export function isObsidianCommentOnlyNode(node: Content): boolean {
  return stripObsidianCommentsFromNodes([node]).length === 0;
}

export function stripAuthoringHtmlFromNodes(nodes: Content[]): Content[] {
  return nodes.filter((node) => !isAuthoringHtmlNode(node));
}

export function stripTrailingAuthoringNodes(nodes: Content[]): Content[] {
  const result = [...nodes];

  while (result.length > 0) {
    const last = result[result.length - 1];
    if (!last) {
      break;
    }

    if (isAuthoringHtmlNode(last)) {
      result.pop();
      continue;
    }

    if (isObsidianCommentOnlyNode(last)) {
      result.pop();
      continue;
    }

    if (isEmptyParagraph(last)) {
      result.pop();
      continue;
    }

    // Trailing --- used as Obsidian section chrome (not mid-answer content)
    if (last.type === "thematicBreak") {
      result.pop();
      continue;
    }

    break;
  }

  return result;
}

export function contentEndOffsetFromNodes(
  nodes: Content[],
  fallbackStart: number,
): number {
  let trimmed = stripTrailingAuthoringNodes(nodes);

  while (trimmed.length > 0 && isAnkiIdHtmlNode(trimmed[trimmed.length - 1]!)) {
    trimmed = trimmed.slice(0, -1);
    trimmed = stripTrailingAuthoringNodes(trimmed);
  }

  const last = trimmed[trimmed.length - 1];
  const end = last?.position?.end?.offset;
  if (end !== undefined) {
    return end;
  }

  return fallbackStart;
}
