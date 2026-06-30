import type { Content, Text } from "mdast";
import type { Node, Parent } from "unist";
import { visit } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";
import {
  createEmptyCardRegions,
  createSourceRange,
  type CardRegions,
  type DelimiterKind,
  type DelimiterRegion,
  type FieldRegion,
} from "./types";

const IGNORED_ANCESTOR_TYPES = new Set(["code", "inlineCode", "math"]);

export type MdastFieldRegion = {
  name: string;
  nodes: Content[];
};

export type ExtractedCardRegions = {
  textNodes: Content[];
  backNodes: Content[];
  fields: MdastFieldRegion[];
  regions: CardRegions;
  hasEmbeddedReversibleDelimiter: boolean;
  hasEmbeddedTypedDelimiter: boolean;
};

type DelimiterMatch = {
  index: number;
  length: number;
  kind: DelimiterKind;
  fieldName?: string;
};

type SplitAtDelimiterResult = {
  front?: Content;
  back?: Content;
  delimiter: DelimiterRegion;
};

export function extractCardRegions(bodyNodes: Content[]): ExtractedCardRegions {
  const textNodes: Content[] = [];
  const backNodes: Content[] = [];
  const fields: MdastFieldRegion[] = [];
  const delimiters: DelimiterRegion[] = [];

  if (bodyNodes.length === 0) {
    return {
      textNodes,
      backNodes,
      fields,
      regions: createEmptyCardRegions(),
      hasEmbeddedReversibleDelimiter: false,
      hasEmbeddedTypedDelimiter: false,
    };
  }

  type Phase = "text" | "back" | "fields";
  let phase: Phase = "text";
  let currentField: MdastFieldRegion | null = null;

  for (const child of bodyNodes) {
    if (phase === "text") {
      const split = splitNodeAtFirstDelimiter(child);
      if (!split) {
        textNodes.push(child);
        continue;
      }

      delimiters.push(split.delimiter);

      if (split.delimiter.kind === "field") {
        phase = "fields";
        if (split.front) {
          textNodes.push(split.front);
        }
        currentField = {
          name: split.delimiter.fieldName ?? "",
          nodes: split.back ? [split.back] : [],
        };
      } else {
        phase = "back";
        if (split.front) {
          textNodes.push(split.front);
        }
        if (split.back) {
          backNodes.push(split.back);
        }
      }
      continue;
    }

    if (phase === "back") {
      backNodes.push(child);
      continue;
    }

    const split = splitNodeAtFirstDelimiter(child);
    if (split?.delimiter.kind === "field") {
      if (currentField) {
        fields.push(currentField);
      }
      delimiters.push(split.delimiter);
      currentField = {
        name: split.delimiter.fieldName ?? "",
        nodes: [],
      };
      if (split.front) {
        currentField.nodes.push(split.front);
      }
      if (split.back) {
        currentField.nodes.push(split.back);
      }
      continue;
    }

    if (currentField) {
      currentField.nodes.push(child);
    }
  }

  if (currentField) {
    fields.push(currentField);
  }

  const embedded = scanEmbeddedReservedDelimiters(bodyNodes);

  return {
    textNodes,
    backNodes,
    fields,
    regions: buildCardRegions(textNodes, backNodes, fields, delimiters),
    hasEmbeddedReversibleDelimiter: embedded.hasReversible,
    hasEmbeddedTypedDelimiter: embedded.hasTyped,
  };
}

function scanEmbeddedReservedDelimiters(bodyNodes: Content[]): {
  hasReversible: boolean;
  hasTyped: boolean;
} {
  let hasReversible = false;
  let hasTyped = false;

  for (const node of bodyNodes) {
    visit(node, (visited) => {
      if (visited.type !== "text" || !("value" in visited)) {
        return;
      }

      const value = String(visited.value);
      let searchFrom = 0;
      while (searchFrom < value.length) {
        const index = value.indexOf(":::", searchFrom);
        if (index === -1) {
          break;
        }

        const classified = classifyTripleColon(value, index);
        if (classified?.kind === ":::r") {
          hasReversible = true;
        }
        if (classified?.kind === ":::t") {
          hasTyped = true;
        }

        searchFrom = index + 3;
      }
    });
  }

  return { hasReversible, hasTyped };
}

function buildCardRegions(
  textNodes: Content[],
  backNodes: Content[],
  fields: MdastFieldRegion[],
  delimiters: DelimiterRegion[],
): CardRegions {
  const regions: CardRegions = { delimiters };

  const textRange = nodesRange(textNodes);
  if (textRange) {
    regions.text = textRange;
  }

  const backRange = nodesRange(backNodes);
  if (backRange) {
    regions.back = backRange;
  }

  if (fields.length > 0) {
    regions.fields = fields
      .map((field): FieldRegion | undefined => {
        const range = nodesRange(field.nodes);
        if (!range) {
          return undefined;
        }
        return { name: field.name, range };
      })
      .filter((field): field is FieldRegion => field !== undefined);
  }

  return regions;
}

function nodesRange(nodes: Content[]): ReturnType<typeof createSourceRange> | undefined {
  if (nodes.length === 0) {
    return undefined;
  }

  let start: number | undefined;
  let end: number | undefined;

  for (const node of nodes) {
    visit(node, (visited) => {
      const position = visited.position;
      if (!position) {
        return;
      }

      const nodeStart = position.start?.offset;
      const nodeEnd = position.end?.offset;

      if (nodeStart !== undefined && (start === undefined || nodeStart < start)) {
        start = nodeStart;
      }
      if (nodeEnd !== undefined && (end === undefined || nodeEnd > end)) {
        end = nodeEnd;
      }
    });
  }

  if (start === undefined || end === undefined) {
    return undefined;
  }

  return createSourceRange(start, end);
}

function splitNodeAtFirstDelimiter(node: Content): SplitAtDelimiterResult | null {
  let splitInfo:
    | {
        parent: Parent;
        textNode: Text;
        index: number;
        match: DelimiterMatch;
      }
    | undefined;

  visitParents(node, (visited, ancestors) => {
    if (splitInfo) {
      return;
    }

    if (visited.type !== "text" || !("value" in visited)) {
      return;
    }

    if (isIgnoredContext(ancestors)) {
      return;
    }

    const value = String(visited.value);
    const match = findFirstDelimiterInText(value);
    if (!match) {
      return;
    }

    const parent = ancestors[ancestors.length - 1] as Parent | undefined;
    if (!parent?.children) {
      return;
    }

    const index = parent.children.indexOf(visited);
    if (index === -1) {
      return;
    }

    splitInfo = {
      parent,
      textNode: visited as Text,
      index,
      match,
    };
  });

  if (!splitInfo) {
    return null;
  }

  const { parent, textNode, index, match } = splitInfo;
  const frontText = textNode.value.slice(0, match.index).trimEnd();
  const backText = textNode.value
    .slice(match.index + match.length)
    .trimStart();

  const frontClone = structuredClone(node) as Content;
  const backClone = structuredClone(node) as Content;

  const frontTextNode = findCorrespondingTextNode(frontClone, parent, index);
  const backTextNode = findCorrespondingTextNode(backClone, parent, index);

  if (!frontTextNode || !backTextNode) {
    return null;
  }

  if (frontText.length === 0) {
    removeChildAtPath(frontClone, parent, index);
  } else {
    frontTextNode.value = frontText;
    trimChildrenAfterIndex(frontClone, parent, index);
  }

  if (backText.length === 0) {
    removeChildAtPath(backClone, parent, index);
  } else {
    backTextNode.value = backText;
    trimChildrenBeforeIndex(backClone, parent, index);
  }

  const textStart = textNode.position?.start?.offset;
  const delimiter: DelimiterRegion = {
    kind: match.kind,
    range:
      textStart !== undefined
        ? createSourceRange(
            textStart + match.index,
            textStart + match.index + match.length,
          )
        : createSourceRange(0, match.length),
    ...(match.fieldName ? { fieldName: match.fieldName } : {}),
  };

  return {
    front: isEmptyNode(frontClone) ? undefined : frontClone,
    back: isEmptyNode(backClone) ? undefined : backClone,
    delimiter,
  };
}

function isIgnoredContext(ancestors: Node[]): boolean {
  return ancestors.some((ancestor) =>
    IGNORED_ANCESTOR_TYPES.has(ancestor.type),
  );
}

function isAtLineStart(value: string, index: number): boolean {
  let cursor = index - 1;
  while (cursor >= 0 && value[cursor] === " ") {
    cursor -= 1;
  }
  if (cursor < 0) {
    return true;
  }
  return value[cursor] === "\n";
}

function isIdentifierContinuer(char: string | undefined): boolean {
  return char !== undefined && /[a-zA-Z0-9_]/.test(char);
}

function classifyTripleColon(
  value: string,
  index: number,
): DelimiterMatch | null {
  if (!value.startsWith(":::", index)) {
    return null;
  }

  const atLineStart = isAtLineStart(value, index);
  const after = value.slice(index + 3);

  if (!atLineStart) {
    return null;
  }

  if (after.startsWith("r") && !isIdentifierContinuer(after[1])) {
    return { index, length: 4, kind: ":::r" };
  }
  if (after.startsWith("t") && !isIdentifierContinuer(after[1])) {
    return { index, length: 4, kind: ":::t" };
  }
  if (after.startsWith(" ")) {
    const lineRemainder = after.slice(1);
    const newlineIndex = lineRemainder.indexOf("\n");
    const linePart =
      newlineIndex === -1
        ? lineRemainder
        : lineRemainder.slice(0, newlineIndex);
    const fieldName = linePart.trim();
    if (!fieldName) {
      return null;
    }
    return {
      index,
      length: 3 + 1 + linePart.length,
      kind: "field",
      fieldName,
    };
  }
  return { index, length: 3, kind: ":::" };
}

function findFirstDelimiterInText(value: string): DelimiterMatch | null {
  let earliest: DelimiterMatch | null = null;
  let searchFrom = 0;

  while (searchFrom < value.length) {
    const index = value.indexOf(":::", searchFrom);
    if (index === -1) {
      break;
    }

    const classified = classifyTripleColon(value, index);
    if (classified && (!earliest || classified.index < earliest.index)) {
      earliest = classified;
    }

    searchFrom = index + 3;
  }

  return earliest;
}

function findCorrespondingTextNode(
  root: Content,
  targetParent: Parent,
  childIndex: number,
): Text | undefined {
  let found: Text | undefined;
  let parentCount = 0;

  visitParents(root, (visited, ancestors) => {
    if (found) {
      return;
    }

    if (
      visited.type === "text" &&
      ancestors.length === targetParent.children.length
    ) {
      const immediateParent = ancestors[ancestors.length - 1] as Parent;
      const index = immediateParent.children.indexOf(visited);
      if (index === childIndex && parentCount === 0) {
        found = visited as Text;
      }
    }

    if (visited === root) {
      parentCount += 1;
    }
  });

  if (found) {
    return found;
  }

  let match: Text | undefined;
  visitParents(root, (visited, ancestors) => {
    if (match) {
      return;
    }

    if (visited.type !== "text") {
      return;
    }

    const immediateParent = ancestors[ancestors.length - 1] as Parent | undefined;
    if (!immediateParent) {
      return;
    }

    const index = immediateParent.children.indexOf(visited);
    if (index === childIndex) {
      match = visited as Text;
    }
  });

  return match;
}

function trimChildrenAfterIndex(
  root: Content,
  targetParent: Parent,
  childIndex: number,
): void {
  visitParents(root, (visited, ancestors) => {
    const immediateParent = ancestors[ancestors.length - 1] as Parent | undefined;
    if (!immediateParent || visited.type !== "text") {
      return;
    }

    const index = immediateParent.children.indexOf(visited);
    if (index > childIndex) {
      const parentIndex = ancestors.length - 1;
      const grandparent = ancestors[parentIndex - 1] as Parent | undefined;
      if (grandparent) {
        const parentPosition = grandparent.children.indexOf(immediateParent);
        immediateParent.children = immediateParent.children.slice(0, childIndex + 1);
        grandparent.children[parentPosition] = immediateParent;
      }
    }
  });
}

function trimChildrenBeforeIndex(
  root: Content,
  targetParent: Parent,
  childIndex: number,
): void {
  visitParents(root, (visited, ancestors) => {
    const immediateParent = ancestors[ancestors.length - 1] as Parent | undefined;
    if (!immediateParent || visited.type !== "text") {
      return;
    }

    const index = immediateParent.children.indexOf(visited);
    if (index === childIndex) {
      immediateParent.children = immediateParent.children.slice(index);
    }
  });
}

function removeChildAtPath(
  root: Content,
  targetParent: Parent,
  childIndex: number,
): void {
  visitParents(root, (visited, ancestors) => {
    const immediateParent = ancestors[ancestors.length - 1] as Parent | undefined;
    if (!immediateParent || visited.type !== "text") {
      return;
    }

    const index = immediateParent.children.indexOf(visited);
    if (index === childIndex) {
      immediateParent.children.splice(index, 1);
    }
  });
}

function isEmptyNode(node: Content): boolean {
  if (node.type === "text") {
    return node.value.trim().length === 0;
  }

  if (!("children" in node) || !Array.isArray(node.children)) {
    return false;
  }

  return node.children.length === 0;
}
