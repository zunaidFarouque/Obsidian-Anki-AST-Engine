import type { Node } from "unist";

const IGNORED_ANCESTOR_TYPES = new Set(["code", "inlineCode", "math"]);

export type DelimiterMatch = {
  index: number;
  length: number;
};

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

  return findDelimiterMatch(value, delimiter) !== null;
}

export function findDelimiterIndex(
  value: string,
  delimiter: string,
): number {
  return findDelimiterMatch(value, delimiter)?.index ?? -1;
}

/**
 * Locate a structural delimiter and how many characters it consumes.
 * For `:::`, also consume a trailing `r` / `t` modifier (:::r / :::t)
 * so sync Back fields are not polluted with a stray letter.
 */
export function findDelimiterMatch(
  value: string,
  delimiter: string,
): DelimiterMatch | null {
  if (delimiter === "?") {
    const trimmed = value.trim();
    if (trimmed === "?") {
      return { index: value.indexOf("?"), length: 1 };
    }

    const inlineSplit = value.match(/\?(?=\s)/);
    if (inlineSplit?.index !== undefined) {
      return { index: inlineSplit.index, length: 1 };
    }

    return null;
  }

  if (delimiter === ":::") {
    const trimmed = value.trim();
    if (trimmed === ":::" || trimmed === ":::r" || trimmed === ":::t") {
      const index = value.indexOf(":::");
      if (index === -1) {
        return null;
      }
      return {
        index,
        length: tripleColonConsumedLength(value, index),
      };
    }

    const index = value.indexOf(":::");
    if (index === -1) {
      return null;
    }
    return {
      index,
      length: tripleColonConsumedLength(value, index),
    };
  }

  const index = value.indexOf(delimiter);
  if (index === -1) {
    return null;
  }
  return { index, length: delimiter.length };
}

function isIdentifierContinuer(char: string | undefined): boolean {
  return char !== undefined && /[a-zA-Z0-9_]/.test(char);
}

function tripleColonConsumedLength(value: string, index: number): number {
  const after = value.slice(index + 3);
  if (after.startsWith("r") && !isIdentifierContinuer(after[1])) {
    return 4;
  }
  if (after.startsWith("t") && !isIdentifierContinuer(after[1])) {
    return 4;
  }
  return 3;
}
