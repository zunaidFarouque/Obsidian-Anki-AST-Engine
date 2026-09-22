import type { RootContent, FootnoteDefinition, Image, Parents, Root } from "mdast";
import rehypeStringify from "rehype-stringify";
import type { State } from "mdast-util-to-hast";
import type { Element } from "hast";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { FootnoteEmbedRef } from "./remarkFootnoteEmbed";
import {
  buildFootnoteEmbedContext,
  buildMultiFieldFootnoteEmbedContext,
  prepareFootnoteRoot,
} from "./remarkFootnoteEmbed";
import { remarkObsidianCallout } from "./remarkObsidianCallout";
import type { ObsidianCallout } from "./remarkObsidianCallout";
import { remarkObsidianHighlight } from "./remarkObsidianHighlight";
import { remarkPreviewHeading } from "./remarkPreviewHeading";
import { remarkObsidianComment, stripObsidianCommentsFromNodes } from "./remarkObsidianComment";
import { stripAuthoringHtmlFromNodes } from "./stripAuthoringContent";

const compiler = unified()
  .use(remarkObsidianComment)
  .use(remarkPreviewHeading)
  .use(remarkObsidianHighlight)
  .use(remarkObsidianCallout)
  .use(remarkRehype, {
    handlers: {
      obsidianHighlight(state: State, node: Parents): Element {
        const result: Element = {
          type: "element",
          tagName: "mark",
          properties: {},
          children: state.all(node),
        };
        state.patch(node, result);
        return state.applyData(node, result);
      },
      obsidianCallout(state: State, node: Parents): Element {
        const callout = node as unknown as ObsidianCallout;
        const bodyChildren = state.all(node);
        const children: Element["children"] = [...bodyChildren];

        if (callout.title) {
          children.unshift({
            type: "element",
            tagName: "p",
            properties: { className: ["callout-title"] },
            children: [{ type: "text", value: callout.title }],
          });
        }

        const result: Element = {
          type: "element",
          tagName: "div",
          properties: {
            className: ["callout", `callout-${callout.calloutType}`],
          },
          children,
        };
        state.patch(node, result);
        return state.applyData(node, result);
      },
      footnoteEmbedRef(state: State, node: Parents): Element {
        const reference = node as unknown as FootnoteEmbedRef;
        const result: Element = {
          type: "element",
          tagName: "sup",
          properties: {},
          children: [{ type: "text", value: String(reference.number) }],
        };
        state.patch(node, result);
        return state.applyData(node, result);
      },
      inlineMath(
        state: State,
        node: { type: string; value: string; [key: string]: unknown },
      ): Element {
        const result: Element = {
          type: "element",
          tagName: "span",
          properties: { className: ["math-inline"] },
          children: [{ type: "text", value: `\\(${node.value}\\)` }],
        };
        state.patch(node as unknown as Parameters<typeof state.patch>[0], result);
        return result;
      },
      math(
        state: State,
        node: { type: string; value: string; [key: string]: unknown },
      ): Element {
        const result: Element = {
          type: "element",
          tagName: "p",
          properties: {},
          children: [{ type: "text", value: `\\[${node.value}\\]` }],
        };
        state.patch(node as unknown as Parameters<typeof state.patch>[0], result);
        return state.applyData(node as unknown as Parameters<typeof state.patch>[0], result);
      },
      image(state: State, node: Image): Element {
        const result: Element = {
          type: "element",
          tagName: "img",
          properties: {
            src: node.url,
            alt: node.alt ?? "",
          },
          children: [],
        };
        state.patch(node, result);
        return state.applyData(node, result);
      },
      table(state: State, node: Parents): Element {
        const result: Element = {
          type: "element",
          tagName: "table",
          properties: { className: ["anki-md-table"] },
          children: state.all(node),
        };
        state.patch(node, result);
        return state.applyData(node, result);
      },
    },
  } as Parameters<typeof remarkRehype>[0])
  .use(rehypeStringify, { allowDangerousHtml: true });

export type CompiledCardFields = {
  frontHtml: string;
  backHtml: string;
};

function compileRoot(root: Root): string {
  return String(compiler.stringify(compiler.runSync(root))).trim();
}

function stripMathHastAliases(nodes: RootContent[]): RootContent[] {
  const result: RootContent[] = [];

  for (const node of nodes) {
    if (node.type === "math" || node.type === "inlineMath") {
      const mathNode = node as RootContent & { data?: Record<string, unknown> };
      if (mathNode.data) {
        const remainingData = { ...mathNode.data };
        delete remainingData.hName;
        delete remainingData.hChildren;
        delete remainingData.hProperties;
        const cleaned: RootContent & { data?: Record<string, unknown> } = {
          ...mathNode,
        };
        if (Object.keys(remainingData).length > 0) {
          cleaned.data = remainingData;
        } else {
          delete cleaned.data;
        }
        result.push(cleaned);
        continue;
      }
    }

    if ("children" in node && Array.isArray(node.children)) {
      result.push({
        ...node,
        children: stripMathHastAliases(node.children),
      } as RootContent);
      continue;
    }

    result.push(node);
  }

  return result;
}

function hoistSingleChildMediaParagraphs(nodes: RootContent[]): RootContent[] {
  const result: RootContent[] = [];

  for (const node of nodes) {
    if (
      node.type === "paragraph" &&
      node.children.length === 1 &&
      node.children[0]?.type === "image"
    ) {
      const child = node.children[0];
      if (child) {
        result.push(child);
        continue;
      }
    }

    result.push(node);
  }

  return result;
}

function cleanFieldNodes(nodes: RootContent[]): RootContent[] {
  return hoistSingleChildMediaParagraphs(
    stripMathHastAliases(
      stripObsidianCommentsFromNodes(stripAuthoringHtmlFromNodes(nodes)),
    ),
  );
}

export function compileCardField(nodes: RootContent[]): string {
  return compileRoot({
    type: "root",
    children: cleanFieldNodes(nodes),
  });
}

export type CompileCardFieldsOptions = {
  inheritedFootnoteDefs?: Map<string, FootnoteDefinition>;
};

export function compileCardFields(
  frontNodes: RootContent[],
  backNodes: RootContent[],
  options: CompileCardFieldsOptions = {},
): CompiledCardFields {
  const strippedFront = cleanFieldNodes(frontNodes);
  const strippedBack = cleanFieldNodes(backNodes);
  const context = buildFootnoteEmbedContext(strippedFront, strippedBack, {
    inheritedDefs: options.inheritedFootnoteDefs,
  });

  return {
    frontHtml: compileRoot(
      prepareFootnoteRoot(strippedFront, context, { appendFooterFor: "front" }),
    ),
    backHtml: compileRoot(
      prepareFootnoteRoot(strippedBack, context, { appendFooterFor: "back" }),
    ),
  };
}

export function compileCustomCardFields(
  fields: Array<{ name: string; nodes: RootContent[] }>,
  options: CompileCardFieldsOptions = {},
): Record<string, string> {
  const cleanedFields = fields.map((f) => ({
    name: f.name.trim(),
    nodes: cleanFieldNodes(f.nodes),
  }));

  const { context, fieldOrders } = buildMultiFieldFootnoteEmbedContext(
    cleanedFields.map((f) => f.nodes),
    { inheritedDefs: options.inheritedFootnoteDefs },
  );

  const result: Record<string, string> = {};

  for (let i = 0; i < cleanedFields.length; i += 1) {
    const field = cleanedFields[i];
    const fieldOrder = fieldOrders[i] ?? [];
    const html = compileRoot(
      prepareFootnoteRoot(field.nodes, context, { appendFooterOrder: fieldOrder }),
    );

    if (result[field.name] !== undefined) {
      result[field.name] = `${result[field.name]}<br>\n${html}`;
    } else {
      result[field.name] = html;
    }
  }

  return result;
}
