import type { Content, Heading, Root } from "mdast";

export type TypeDeclaration = {
  kind: "cardType" | "noteType";
  value: string;
};

export type OutlineHeading = {
  depth: number;
  text: string;
  node: Heading;
  ancestors: OutlineHeading[];
};

export type OutlineTree = {
  cardDeclarationLevel: number;
  cardHeadings: OutlineHeading[];
  sectionHeadings: OutlineHeading[];
};

export type HeadingInput = {
  depth: number;
  text: string;
  node?: Heading;
};

function getHeadingText(heading: Heading): string {
  return heading.children
    .map((child) => ("value" in child ? String(child.value) : ""))
    .join("")
    .trim();
}

function snapshotAncestors(
  contextByDepth: Map<number, OutlineHeading>,
  cardDeclarationLevel: number,
): OutlineHeading[] {
  const ancestors: OutlineHeading[] = [];

  for (let depth = cardDeclarationLevel - 1; depth >= 1; depth -= 1) {
    const ancestor = contextByDepth.get(depth);
    if (ancestor) {
      ancestors.push(ancestor);
    }
  }

  return ancestors;
}

function updateContext(
  contextByDepth: Map<number, OutlineHeading>,
  depth: number,
  heading: OutlineHeading,
): void {
  contextByDepth.set(depth, heading);

  for (const existingDepth of [...contextByDepth.keys()]) {
    if (existingDepth > depth) {
      contextByDepth.delete(existingDepth);
    }
  }
}

function createOutlineHeading(
  depth: number,
  text: string,
  node: Heading,
  ancestors: OutlineHeading[],
): OutlineHeading {
  return {
    depth,
    text,
    node,
    ancestors: ancestors.map((ancestor) => ({
      depth: ancestor.depth,
      text: ancestor.text,
      node: ancestor.node,
      ancestors: ancestor.ancestors,
    })),
  };
}

export function buildOutline(
  headings: HeadingInput[],
  cardDeclarationLevel = 4,
): OutlineTree {
  const cardHeadings: OutlineHeading[] = [];
  const sectionHeadings: OutlineHeading[] = [];
  const contextByDepth = new Map<number, OutlineHeading>();

  for (const input of headings) {
    const node = input.node ?? ({ type: "heading", depth: input.depth, children: [] } as Heading);
    const ancestors = snapshotAncestors(contextByDepth, cardDeclarationLevel);

    if (input.depth < cardDeclarationLevel) {
      const sectionHeading = createOutlineHeading(
        input.depth,
        input.text,
        node,
        ancestors,
      );
      sectionHeadings.push(sectionHeading);
      updateContext(contextByDepth, input.depth, sectionHeading);
      continue;
    }

    if (input.depth === cardDeclarationLevel) {
      cardHeadings.push(
        createOutlineHeading(input.depth, input.text, node, ancestors),
      );
    }
  }

  return {
    cardDeclarationLevel,
    cardHeadings,
    sectionHeadings,
  };
}

export function buildOutlineFromAst(
  ast: Root,
  cardDeclarationLevel = 4,
): OutlineTree {
  const headings: HeadingInput[] = [];

  for (const child of ast.children) {
    if (child.type !== "heading") {
      continue;
    }

    const heading = child as Heading;
    headings.push({
      depth: heading.depth,
      text: getHeadingText(heading),
      node: heading,
    });
  }

  return buildOutline(headings, cardDeclarationLevel);
}

export function getAncestorHeadings(cardHeading: OutlineHeading): OutlineHeading[] {
  return cardHeading.ancestors;
}

export function findNearestTypeDeclaration(
  ancestors: OutlineHeading[],
  getTypeDeclaration: (heading: OutlineHeading) => TypeDeclaration | undefined,
): TypeDeclaration | undefined {
  for (const ancestor of ancestors) {
    const declaration = getTypeDeclaration(ancestor);
    if (declaration) {
      return declaration;
    }
  }

  return undefined;
}

export function collectHeadingsFromAst(ast: Root): Heading[] {
  const headings: Heading[] = [];

  const visit = (node: Content) => {
    if (node.type === "heading") {
      headings.push(node as Heading);
    }

    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child as Content);
      }
    }
  };

  for (const child of ast.children) {
    visit(child);
  }

  return headings;
}
