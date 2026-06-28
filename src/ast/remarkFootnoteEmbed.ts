import type {
  Content,
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
  frontNodes: Content[],
  backNodes: Content[],
): Map<string, FootnoteDefinition> {
  const definitions = new Map<string, FootnoteDefinition>();

  for (const node of [...frontNodes, ...backNodes]) {
    if (node.type === "footnoteDefinition") {
      const definition = node as FootnoteDefinition;
      const id = normalizeId(definition.identifier);
      if (!definitions.has(id)) {
        definitions.set(id, definition);
      }
    }
  }

  return definitions;
}

export function buildFootnoteEmbedContext(
  frontNodes: Content[],
  backNodes: Content[],
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

  const markReference = (nodes: Content[], sideOrder: string[]) => {
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
  nodes: Content[],
  context: FootnoteEmbedContext,
): Content[] {
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

    const reference = node as FootnoteReference;
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
): Content[] {
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

export function prepareFootnoteNodes(
  nodes: Content[],
  context: FootnoteEmbedContext,
  options: { appendFooterFor?: "front" | "back" },
): Content[] {
  const prepared = replaceFootnoteReferences(nodes, context);
  const sideOrder =
    options.appendFooterFor === "front"
      ? context.frontOrder
      : options.appendFooterFor === "back"
        ? context.backOrder
        : [];

  if (!options.appendFooterFor) {
    return prepared;
  }

  return [...prepared, ...buildFootnoteFooter(context, sideOrder)];
}

export function prepareFootnoteRoot(
  nodes: Content[],
  context: FootnoteEmbedContext,
  options: { appendFooterFor?: "front" | "back" },
): Root {
  return {
    type: "root",
    children: prepareFootnoteNodes(nodes, context, options),
  };
}
