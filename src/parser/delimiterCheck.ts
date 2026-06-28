import type { Node } from "unist";

const IGNORED_ANCESTOR_TYPES = new Set(["code", "inlineCode", "math"]);

export function isStructuralDelimiter(
  node: Node,
  ancestors: Node[],
  delimiter: string,
): boolean {
  if (node.type !== "text" || !("value" in node)) {
    return false;
  }

  const value = node.value as string;
  if (!value.includes(delimiter)) {
    return false;
  }

  if (ancestors.some((ancestor) => IGNORED_ANCESTOR_TYPES.has(ancestor.type))) {
    return false;
  }

  return findDelimiterIndex(value, delimiter) !== -1;
}

export function findDelimiterIndex(
  value: string,
  delimiter: string,
): number {
  if (delimiter === "?") {
    const trimmed = value.trim();
    if (trimmed === "?") {
      return value.indexOf("?");
    }

    const inlineSplit = value.match(/\?(?=\s)/);
    if (inlineSplit?.index !== undefined) {
      return inlineSplit.index;
    }

    return -1;
  }

  if (delimiter === ":::") {
    const trimmed = value.trim();
    if (trimmed === ":::") {
      return value.indexOf(":::");
    }

    return value.indexOf(":::");
  }

  return value.indexOf(delimiter);
}
