import type {
  RootContent,
  FootnoteDefinition,
  FootnoteReference,
  List,
  ListItem,
  Root,
} from "mdast";
import { visit } from "unist-util-visit";

export type FootnoteEmbedRef = {
  type: "footnoteEmbedRef";
  number: number;
};

export type FootnoteEmbedContext = {
  definitions: Map<string, FootnoteDefinition>;
  order: string[];
  frontOrder: string[];
  backOrder: string[];
};

export type BuildFootnoteEmbedContextOptions = {
  inheritedDefs?: Map<string, FootnoteDefinition>;
};

function normalizeId(identifier: string): string {
  return identifier.toUpperCase();
}

function collectCardLocalDefs(
  frontNodes: RootContent[],
  backNodes: RootContent[],
): Map<string, FootnoteDefinition> {
  const definitions = new Map<string, FootnoteDefinition>();

  for (const node of [...frontNodes, ...backNodes]) {
    if (node.type === "footnoteDefinition") {
      const definition = node;
      const id = normalizeId(definition.identifier);
      if (!definitions.has(id)) {
        definitions.set(id, definition);
      }
    }
  }

  return definitions;
}

export function buildFootnoteEmbedContext(
  frontNodes: RootContent[],
  backNodes: RootContent[],
  options: BuildFootnoteEmbedContextOptions = {},
): FootnoteEmbedContext {
  const definitions = new Map<string, FootnoteDefinition>();

  if (options.inheritedDefs) {
    for (const [id, definition] of options.inheritedDefs) {
      definitions.set(id, definition);
    }
  }

  const cardLocalDefs = collectCardLocalDefs(frontNodes, backNodes);
  for (const [id, definition] of cardLocalDefs) {
    definitions.set(id, definition);
  }

  const order: string[] = [];
  const frontOrder: string[] = [];
  const backOrder: string[] = [];

  const markReference = (nodes: RootContent[], sideOrder: string[]) => {
    visit({ type: "root", children: nodes }, (visited) => {
      if (visited.type !== "footnoteReference") {
        return;
      }

      const reference = visited as FootnoteReference;
      const id = normalizeId(reference.identifier);
      if (!definitions.has(id)) {
        return;
      }

      if (!sideOrder.includes(id)) {
        sideOrder.push(id);
      }

      if (!order.includes(id)) {
        order.push(id);
      }
    });
  };

  markReference(frontNodes, frontOrder);
  markReference(backNodes, backOrder);

  return { definitions, order, frontOrder, backOrder };
}

function replaceFootnoteReferences(
  nodes: RootContent[],
  context: FootnoteEmbedContext,
): RootContent[] {
  const idToNumber = new Map(
    context.order.map((id, index) => [id, index + 1] as const),
  );
  const root: Root = {
    type: "root",
    children: nodes.filter((node) => node.type !== "footnoteDefinition"),
  };

  visit(root, "footnoteReference", (node, index, parent) => {
    if (!parent || index === undefined || !("children" in parent)) {
      return;
    }

    const reference = node;
    const number = idToNumber.get(normalizeId(reference.identifier));
    if (!number) {
      return;
    }

    parent.children[index] = {
      type: "footnoteEmbedRef",
      number,
    } as unknown as FootnoteReference;
  });

  return root.children;
}

function buildFootnoteFooter(
  context: FootnoteEmbedContext,
  sideOrder: string[],
): RootContent[] {
  if (sideOrder.length === 0) {
    return [];
  }

  const listItems: ListItem[] = sideOrder.map((id) => {
    const definition = context.definitions.get(id);
    return {
      type: "listItem",
      children: definition?.children ?? [
        { type: "paragraph", children: [{ type: "text", value: "" }] },
      ],
    };
  });

  const list: List = {
    type: "list",
    ordered: true,
    children: listItems,
  };

  return [{ type: "thematicBreak" }, list];
}

export function buildMultiFieldFootnoteEmbedContext(
  fieldNodesList: RootContent[][],
  options: BuildFootnoteEmbedContextOptions = {},
): {
  context: FootnoteEmbedContext;
  fieldOrders: string[][];
} {
  const definitions = new Map<string, FootnoteDefinition>();

  if (options.inheritedDefs) {
    for (const [id, definition] of options.inheritedDefs) {
      definitions.set(id, definition);
    }
  }

  for (const nodes of fieldNodesList) {
    for (const node of nodes) {
      if (node.type === "footnoteDefinition") {
        const definition = node;
        const id = normalizeId(definition.identifier);
        if (!definitions.has(id)) {
          definitions.set(id, definition);
        }
      }
    }
  }

  const order: string[] = [];
  const fieldOrders: string[][] = [];

  for (const nodes of fieldNodesList) {
    const fieldOrder: string[] = [];
    visit({ type: "root", children: nodes }, (visited) => {
      if (visited.type !== "footnoteReference") {
        return;
      }

      const reference = visited as FootnoteReference;
      const id = normalizeId(reference.identifier);
      if (!definitions.has(id)) {
        return;
      }

      if (!fieldOrder.includes(id)) {
        fieldOrder.push(id);
      }

      if (!order.includes(id)) {
        order.push(id);
      }
    });
    fieldOrders.push(fieldOrder);
  }

  const context: FootnoteEmbedContext = {
    definitions,
    order,
    frontOrder: fieldOrders[0] ?? [],
    backOrder: fieldOrders[1] ?? [],
  };

  return { context, fieldOrders };
}

export function prepareFootnoteNodes(
  nodes: RootContent[],
  context: FootnoteEmbedContext,
  options: { appendFooterFor?: "front" | "back"; appendFooterOrder?: string[] },
): RootContent[] {
  const prepared = replaceFootnoteReferences(nodes, context);
  const sideOrder =
    options.appendFooterOrder ??
    (options.appendFooterFor === "front"
      ? context.frontOrder
      : options.appendFooterFor === "back"
        ? context.backOrder
        : []);

  if (!options.appendFooterFor && !options.appendFooterOrder) {
    return prepared;
  }

  return [...prepared, ...buildFootnoteFooter(context, sideOrder)];
}

export function prepareFootnoteRoot(
  nodes: RootContent[],
  context: FootnoteEmbedContext,
  options: { appendFooterFor?: "front" | "back"; appendFooterOrder?: string[] },
): Root {
  return {
    type: "root",
    children: prepareFootnoteNodes(nodes, context, options),
  };
}
