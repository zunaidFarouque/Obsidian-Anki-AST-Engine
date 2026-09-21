import type { RootContent, FootnoteDefinition, Heading, Root } from "mdast";

function normalizeId(identifier: string): string {
  return identifier.toUpperCase();
}

function getHeadingText(heading: Heading): string {
  return heading.children
    .map((child) => ("value" in child ? String(child.value) : ""))
    .join("")
    .trim();
}

function isWithinBody(node: RootContent, bodyStartOffset: number): boolean {
  if (bodyStartOffset === 0) {
    return true;
  }

  const start = node.position?.start?.offset;
  if (start === undefined) {
    return true;
  }

  return start >= bodyStartOffset;
}

function collectFootnoteDefinitions(node: RootContent): FootnoteDefinition[] {
  if (node.type === "footnoteDefinition") {
    return [node];
  }

  if (!("children" in node) || !Array.isArray(node.children)) {
    return [];
  }

  const definitions: FootnoteDefinition[] = [];
  const parentNode = node as { children: RootContent[] };
  for (const child of parentNode.children) {
    definitions.push(...collectFootnoteDefinitions(child));
  }
  return definitions;
}

function mergeDefs(
  target: Map<string, FootnoteDefinition>,
  source: Map<string, FootnoteDefinition>,
): void {
  for (const [id, definition] of source) {
    target.set(id, definition);
  }
}

function buildContextPath(contextByDepth: Map<number, string>): string {
  const depths = [...contextByDepth.keys()].sort((a, b) => a - b);
  return depths
    .map((depth) => `${depth}:${contextByDepth.get(depth) ?? ""}`)
    .join("|");
}

function buildPrefixPaths(contextByDepth: Map<number, string>): string[] {
  const depths = [...contextByDepth.keys()].sort((a, b) => a - b);
  const paths: string[] = [];
  let current = "";

  for (const depth of depths) {
    const title = contextByDepth.get(depth) ?? "";
    current = current.length === 0 ? `${depth}:${title}` : `${current}|${depth}:${title}`;
    paths.push(current);
  }

  return paths;
}

export type FootnoteScopeIndex = {
  resolveForCard(card: { sectionDepths: Map<number, string> }): Map<string, FootnoteDefinition>;
};

export function buildFootnoteScopeIndex(
  ast: Root,
  declarationLevel: number,
  bodyStartOffset = 0,
): FootnoteScopeIndex {
  const preambleDefs = new Map<string, FootnoteDefinition>();
  const defsByContextPath = new Map<string, Map<string, FootnoteDefinition>>();
  const defsByHeadingRange = new Map<string, Map<string, FootnoteDefinition>>();

  const contextByDepth = new Map<number, string>();
  let inCard = false;

  const addDefs = (definitions: FootnoteDefinition[]) => {
    if (definitions.length === 0) {
      return;
    }

    const targets: Map<string, FootnoteDefinition>[] = [];

    if (contextByDepth.size === 0) {
      targets.push(preambleDefs);
    } else {
      const exactPath = buildContextPath(contextByDepth);
      if (!defsByContextPath.has(exactPath)) {
        defsByContextPath.set(exactPath, new Map());
      }
      targets.push(defsByContextPath.get(exactPath)!);

      for (const prefix of buildPrefixPaths(contextByDepth)) {
        if (!defsByHeadingRange.has(prefix)) {
          defsByHeadingRange.set(prefix, new Map());
        }
        targets.push(defsByHeadingRange.get(prefix)!);
      }
    }

    for (const definition of definitions) {
      const id = normalizeId(definition.identifier);
      for (const target of targets) {
        target.set(id, definition);
      }
    }
  };

  const updateContext = (depth: number, text: string) => {
    contextByDepth.set(depth, text);
    for (const existingDepth of [...contextByDepth.keys()]) {
      if (existingDepth > depth) {
        contextByDepth.delete(existingDepth);
      }
    }
  };

  for (const child of ast.children) {
    if (!isWithinBody(child, bodyStartOffset)) {
      continue;
    }

    if (child.type === "heading") {
      const heading = child;

      if (heading.depth < declarationLevel) {
        inCard = false;
        updateContext(heading.depth, getHeadingText(heading));
        continue;
      }

      if (heading.depth === declarationLevel) {
        inCard = true;
        continue;
      }
    }

    if (inCard) {
      continue;
    }

    addDefs(collectFootnoteDefinitions(child));
  }

  return {
    resolveForCard(card: { sectionDepths: Map<number, string> }): Map<string, FootnoteDefinition> {
      const inherited = new Map<string, FootnoteDefinition>();

      mergeDefs(inherited, preambleDefs);

      const prefixPaths = buildPrefixPaths(card.sectionDepths);
      for (const prefix of prefixPaths) {
        const rangeDefs = defsByHeadingRange.get(prefix);
        if (rangeDefs) {
          mergeDefs(inherited, rangeDefs);
        }

        const exactDefs = defsByContextPath.get(prefix);
        if (exactDefs) {
          mergeDefs(inherited, exactDefs);
        }
      }

      return inherited;
    },
  };
}
