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
};

function normalizeId(identifier: string): string {
  return identifier.toUpperCase();
}

export function buildFootnoteEmbedContext(
  frontNodes: Content[],
  backNodes: Content[],
): FootnoteEmbedContext {
  const definitions = new Map<string, FootnoteDefinition>();
  const order: string[] = [];

  for (const node of [...frontNodes, ...backNodes]) {
    if (node.type === "footnoteDefinition") {
      const definition = node as FootnoteDefinition;
      const id = normalizeId(definition.identifier);
      if (!definitions.has(id)) {
        definitions.set(id, definition);
      }
    }
  }

  const markReference = (nodes: Content[]) => {
    visit({ type: "root", children: nodes }, (visited) => {
      if (visited.type !== "footnoteReference") {
        return;
      }

      const reference = visited as FootnoteReference;
      const id = normalizeId(reference.identifier);
      if (!definitions.has(id) || order.includes(id)) {
        return;
      }
      order.push(id);
    });
  };

  markReference(frontNodes);
  markReference(backNodes);

  return { definitions, order };
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

function buildFootnoteFooter(context: FootnoteEmbedContext): Content[] {
  if (context.order.length === 0) {
    return [];
  }

  const listItems: ListItem[] = context.order.map((id) => {
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
  options: { appendFooter: boolean },
): Content[] {
  const prepared = replaceFootnoteReferences(nodes, context);
  if (!options.appendFooter) {
    return prepared;
  }
  return [...prepared, ...buildFootnoteFooter(context)];
}

export function prepareFootnoteRoot(
  nodes: Content[],
  context: FootnoteEmbedContext,
  options: { appendFooter: boolean },
): Root {
  return {
    type: "root",
    children: prepareFootnoteNodes(nodes, context, options),
  };
}
