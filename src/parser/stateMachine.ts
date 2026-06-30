import type { Content, Heading, Root, Text } from "mdast";
import type { Node, Parent } from "unist";
import { visitParents } from "unist-util-visit-parents";
import {
  findDelimiterIndex,
  isStructuralDelimiter,
} from "./delimiterCheck";
import { stripTrailingSectionSeparators } from "./stripTrailingSectionSeparators";
import { stripTrailingAuthoringNodes } from "../ast/stripAuthoringContent";

export type ExtractedCard = {
  tag: string;
  frontNodes: Content[];
  backNodes: Content[];
  sectionDepths: Map<number, string>;
  ordinal: number;
  ankiId?: string;
  injectionOffset?: number;
};

export type ExtractOptions = {
  bodyStartOffset?: number;
  cardDeclarationHeadingLevel?: number;
  includeParentHeadersAsTags?: boolean;
};

const ANKI_ID_REGEX =
  /<!--\s*anki-id:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*-->/i;
const ANKI_ID_COMMENT_HINT = /<!--[\s\S]*anki-id[\s\S]*-->/i;

export function extractCards(
  ast: Root,
  delimiter: string,
  options: ExtractOptions = {},
): ExtractedCard[] {
  const bodyStartOffset = options.bodyStartOffset ?? 0;
  const declarationLevel = options.cardDeclarationHeadingLevel;

  if (declarationLevel !== undefined) {
    return extractCardsWithDeclarationLevel(
      ast,
      delimiter,
      declarationLevel,
      bodyStartOffset,
      options.includeParentHeadersAsTags ?? true,
    );
  }

  return extractCardsLegacy(ast, delimiter, bodyStartOffset);
}

function extractCardsWithDeclarationLevel(
  ast: Root,
  delimiter: string,
  declarationLevel: number,
  bodyStartOffset: number,
  includeParentHeadersAsTags: boolean,
): ExtractedCard[] {
  const cards: ExtractedCard[] = [];
  const contextByDepth = new Map<number, string>();
  let currentDeclaration = "";
  let currentTag = "";
  let frontNodes: Content[] = [];
  let backNodes: Content[] = [];
  let phase: "none" | "front" | "back" = "none";
  let delimiterEndOffset: number | undefined;

  const buildTag = (): string => {
    const parts: string[] = [];
    if (includeParentHeadersAsTags) {
      for (let depth = 1; depth < declarationLevel; depth += 1) {
        const contextTag = contextByDepth.get(depth);
        if (contextTag) {
          parts.push(contextTag);
        }
      }
    }
    if (currentDeclaration) {
      parts.push(currentDeclaration);
    }
    return parts.join("::");
  };

  const applyHeadingAsFrontIfNeeded = () => {
    if (frontNodes.length === 0 && currentDeclaration.length > 0) {
      frontNodes.push(createTextParagraph(currentDeclaration));
    }
  };

  const finalizeCard = () => {
    if (phase === "none") {
      return;
    }

    applyHeadingAsFrontIfNeeded();

    if (frontNodes.length === 0 && backNodes.length === 0) {
      phase = "none";
      delimiterEndOffset = undefined;
      return;
    }

    cards.push(
      buildCard(
        currentTag,
        frontNodes,
        backNodes,
        contextByDepth,
        cards.length,
        delimiterEndOffset,
      ),
    );
    frontNodes = [];
    backNodes = [];
    phase = "none";
    delimiterEndOffset = undefined;
  };

  const startDeclaration = (heading: Heading) => {
    finalizeCard();
    currentDeclaration = getHeadingText(heading);
    currentTag = buildTag();
    phase = "front";
    delimiterEndOffset = undefined;
  };

  const updateContext = (depth: number, text: string) => {
    contextByDepth.set(depth, text);
    for (const existingDepth of [...contextByDepth.keys()]) {
      if (existingDepth > depth) {
        contextByDepth.delete(existingDepth);
      }
    }
  };

  const handleContent = (child: Content) => {
    if (phase === "front") {
      const split = splitNodeAtDelimiter(child, delimiter);
      if (split) {
        if (split.front) {
          frontNodes.push(split.front);
        }
        applyHeadingAsFrontIfNeeded();
        if (split.back) {
          backNodes.push(split.back);
        }
        if (split.delimiterEndOffset !== undefined) {
          delimiterEndOffset = split.delimiterEndOffset;
        }
        phase = "back";
      } else {
        frontNodes.push(child);
      }
      return;
    }

    if (phase === "back") {
      backNodes.push(child);
    }
  };

  for (const child of ast.children) {
    if (!isWithinBody(child, bodyStartOffset)) {
      continue;
    }

    if (child.type === "heading") {
      const heading = child as Heading;

      if (heading.depth < declarationLevel) {
        if (phase !== "none") {
          finalizeCard();
        }
        updateContext(heading.depth, getHeadingText(heading));
        continue;
      }

      if (heading.depth === declarationLevel) {
        startDeclaration(heading);
        continue;
      }

      handleContent(child);
      continue;
    }

    if (phase === "none") {
      continue;
    }

    handleContent(child);
  }

  finalizeCard();
  return cards;
}

function extractCardsLegacy(
  ast: Root,
  delimiter: string,
  bodyStartOffset: number,
): ExtractedCard[] {
  const cards: ExtractedCard[] = [];
  let currentTag = "";
  let originatingDepth = Number.POSITIVE_INFINITY;
  let frontNodes: Content[] = [];
  let backNodes: Content[] = [];
  let phase: "none" | "front" | "back" = "none";
  let delimiterEndOffset: number | undefined;

  const finalizeCard = () => {
    if (phase === "none") {
      return;
    }

    if (frontNodes.length === 0 && backNodes.length === 0) {
      phase = "none";
      delimiterEndOffset = undefined;
      return;
    }

    cards.push(
      buildCard(
        currentTag,
        frontNodes,
        backNodes,
        new Map<number, string>(),
        cards.length,
        delimiterEndOffset,
      ),
    );
    frontNodes = [];
    backNodes = [];
    phase = "none";
    delimiterEndOffset = undefined;
  };

  for (const child of ast.children) {
    if (!isWithinBody(child, bodyStartOffset)) {
      continue;
    }

    if (child.type === "heading") {
      const heading = child as Heading;
      if (phase !== "none" && heading.depth <= originatingDepth) {
        finalizeCard();
      }

      currentTag = getHeadingText(heading);
      originatingDepth = heading.depth;
      phase = "front";
      continue;
    }

    if (phase === "none") {
      currentTag = "";
      originatingDepth = Number.POSITIVE_INFINITY;
      phase = "front";
    }

    if (phase === "front") {
      const split = splitNodeAtDelimiter(child, delimiter);
      if (split) {
        if (split.front) {
          frontNodes.push(split.front);
        }
        if (split.back) {
          backNodes.push(split.back);
        }
        if (split.delimiterEndOffset !== undefined) {
          delimiterEndOffset = split.delimiterEndOffset;
        }
        phase = "back";
      } else {
        frontNodes.push(child);
      }
      continue;
    }

    if (phase === "back") {
      backNodes.push(child);
    }
  }

  finalizeCard();
  return cards;
}

function createTextParagraph(text: string): Content {
  return {
    type: "paragraph",
    children: [{ type: "text", value: text }],
  };
}

function isWithinBody(node: Content, bodyStartOffset: number): boolean {
  if (bodyStartOffset === 0) {
    return true;
  }

  const start = node.position?.start?.offset;
  if (start === undefined) {
    return true;
  }

  return start >= bodyStartOffset;
}

function buildCard(
  tag: string,
  frontNodes: Content[],
  backNodes: Content[],
  sectionDepths: Map<number, string>,
  ordinal: number,
  delimiterEndOffset?: number,
): ExtractedCard {
  const trimmedFront = stripTrailingAuthoringNodes(
    stripTrailingSectionSeparators(frontNodes),
  );
  const trimmedBack = stripTrailingAuthoringNodes(
    stripTrailingSectionSeparators(backNodes),
  );
  const ankiId = extractAnkiId(trimmedBack);
  let injectionOffset = ankiId ? undefined : getInjectionOffset(trimmedBack);
  if (injectionOffset === undefined && !ankiId && delimiterEndOffset !== undefined) {
    injectionOffset = delimiterEndOffset;
  }

  return {
    tag,
    frontNodes: trimmedFront,
    backNodes: trimmedBack,
    sectionDepths: new Map(sectionDepths),
    ordinal,
    ankiId,
    injectionOffset,
  };
}

function getHeadingText(heading: Heading): string {
  return heading.children
    .map((child) => ("value" in child ? String(child.value) : ""))
    .join("")
    .trim();
}

function extractAnkiId(backNodes: Content[]): string | undefined {
  for (let index = backNodes.length - 1; index >= 0; index -= 1) {
    const node = backNodes[index];
    if (node?.type === "html" && "value" in node) {
      const match = String(node.value).match(ANKI_ID_REGEX);
      if (match?.[1]) {
        return match[1];
      }
    }
  }

  return undefined;
}

function isRemovableAnkiIdHtmlNode(node: Content): boolean {
  if (node.type !== "html" || !("value" in node)) {
    return false;
  }

  const value = String(node.value);
  return ANKI_ID_REGEX.test(value) || ANKI_ID_COMMENT_HINT.test(value);
}

function getInjectionOffset(backNodes: Content[]): number | undefined {
  const nodes = [...backNodes];

  while (nodes.length > 0) {
    const last = nodes[nodes.length - 1];
    if (last && isRemovableAnkiIdHtmlNode(last)) {
      nodes.pop();
      continue;
    }
    break;
  }

  const lastNode = nodes[nodes.length - 1];
  return lastNode?.position?.end?.offset;
}

type SplitResult = {
  front?: Content;
  back?: Content;
  delimiterEndOffset?: number;
};

function splitNodeAtDelimiter(
  node: Content,
  delimiter: string,
): SplitResult | null {
  let splitInfo:
    | {
        parent: Parent;
        textNode: Text;
        ancestors: Node[];
        index: number;
      }
    | undefined;

  visitParents(node, (visited, ancestors) => {
    if (splitInfo) {
      return;
    }

    if (
      visited.type === "text" &&
      isStructuralDelimiter(visited, ancestors, delimiter)
    ) {
      const parent = ancestors[ancestors.length - 1] as Parent | undefined;
      if (!parent || !parent.children) {
        return;
      }

      const index = parent.children.indexOf(visited);
      if (index === -1) {
        return;
      }

      splitInfo = {
        parent,
        textNode: visited as Text,
        ancestors: [...ancestors],
        index,
      };
    }
  });

  if (!splitInfo) {
    return null;
  }

  const { parent, textNode, index } = splitInfo;
  const delimiterIndex = findDelimiterIndex(textNode.value, delimiter);
  if (delimiterIndex === -1) {
    return null;
  }

  const textStart = textNode.position?.start?.offset;
  const delimiterEndOffset =
    textStart !== undefined
      ? textStart + delimiterIndex + delimiter.length
      : undefined;

  const frontText = textNode.value.slice(0, delimiterIndex).trimEnd();
  const backText = textNode.value
    .slice(delimiterIndex + delimiter.length)
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

  return {
    front: isEmptyNode(frontClone) ? undefined : frontClone,
    back: isEmptyNode(backClone) ? undefined : backClone,
    delimiterEndOffset,
  };
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

    if (visited.type === "text" && ancestors.length === targetParent.children.length) {
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
      return;
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
