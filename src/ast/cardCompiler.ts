import type { Content, FootnoteDefinition, Parents, Root } from "mdast";
import rehypeStringify from "rehype-stringify";
import type { State } from "mdast-util-to-hast";
import type { Element } from "hast";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { FootnoteEmbedRef } from "./remarkFootnoteEmbed";
import {
  buildFootnoteEmbedContext,
  prepareFootnoteRoot,
} from "./remarkFootnoteEmbed";
import { remarkObsidianCallout } from "./remarkObsidianCallout";
import type { ObsidianCallout } from "./remarkObsidianCallout";
import { remarkObsidianHighlight } from "./remarkObsidianHighlight";
import { remarkPreviewHeading } from "./remarkPreviewHeading";

const compiler = unified()
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
      inlineMath(state: State, node): Element {
        const mathNode = node as { value: string };
        const result: Element = {
          type: "element",
          tagName: "span",
          properties: { className: ["math-inline"] },
          children: [{ type: "text", value: `\\(${mathNode.value}\\)` }],
        };
        state.patch(node, result);
        return result;
      },
      math(state: State, node): Element {
        const mathNode = node as { value: string };
        const result: Element = {
          type: "element",
          tagName: "div",
          properties: { className: ["math-display"] },
          children: [{ type: "text", value: `\\[${mathNode.value}\\]` }],
        };
        state.patch(node, result);
        return result;
      },
    },
  } as Parameters<typeof remarkRehype>[0])
  .use(rehypeStringify);

export type CompiledCardFields = {
  frontHtml: string;
  backHtml: string;
};

function compileRoot(root: Root): string {
  return String(compiler.stringify(compiler.runSync(root))).trim();
}

export function compileCardField(nodes: Content[]): string {
  return compileRoot({ type: "root", children: nodes });
}

export type CompileCardFieldsOptions = {
  inheritedFootnoteDefs?: Map<string, FootnoteDefinition>;
};

export function compileCardFields(
  frontNodes: Content[],
  backNodes: Content[],
  options: CompileCardFieldsOptions = {},
): CompiledCardFields {
  const context = buildFootnoteEmbedContext(frontNodes, backNodes, {
    inheritedDefs: options.inheritedFootnoteDefs,
  });

  return {
    frontHtml: compileRoot(
      prepareFootnoteRoot(frontNodes, context, { appendFooterFor: "front" }),
    ),
    backHtml: compileRoot(
      prepareFootnoteRoot(backNodes, context, { appendFooterFor: "back" }),
    ),
  };
}
