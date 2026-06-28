import type { Content, FootnoteDefinition, Image, Parents, Root } from "mdast";
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
import { remarkObsidianComment, stripObsidianCommentsFromNodes } from "./remarkObsidianComment";

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
          tagName: "p",
          properties: {},
          children: [{ type: "text", value: `\\[${mathNode.value}\\]` }],
        };
        state.patch(node, result);
        return state.applyData(node, result);
      },
      image(state: State, node): Element {
        const imageNode = node as Image;
        const result: Element = {
          type: "element",
          tagName: "img",
          properties: {
            src: imageNode.url,
            alt: imageNode.alt ?? "",
          },
          children: [],
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

function stripMathHastAliases(nodes: Content[]): Content[] {
  const result: Content[] = [];

  for (const node of nodes) {
    if (node.type === "math" || node.type === "inlineMath") {
      const mathNode = node as Content & { data?: Record<string, unknown> };
      if (mathNode.data) {
        const { hName, hChildren, hProperties, ...remainingData } = mathNode.data;
        const cleaned: Content & { data?: Record<string, unknown> } = {
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
        children: stripMathHastAliases(node.children as Content[]),
      } as Content);
      continue;
    }

    result.push(node);
  }

  return result;
}

function hoistParagraphImages(nodes: Content[]): Content[] {
  const result: Content[] = [];

  for (const node of nodes) {
    if (
      node.type === "paragraph" &&
      node.children.length === 1 &&
      node.children[0]?.type === "image"
    ) {
      result.push(node.children[0] as Content);
      continue;
    }

    result.push(node);
  }

  return result;
}

export function compileCardField(nodes: Content[]): string {
  return compileRoot({
    type: "root",
    children: hoistParagraphImages(
      stripMathHastAliases(stripObsidianCommentsFromNodes(nodes)),
    ),
  });
}

export type CompileCardFieldsOptions = {
  inheritedFootnoteDefs?: Map<string, FootnoteDefinition>;
};

export function compileCardFields(
  frontNodes: Content[],
  backNodes: Content[],
  options: CompileCardFieldsOptions = {},
): CompiledCardFields {
  const strippedFront = hoistParagraphImages(
    stripMathHastAliases(stripObsidianCommentsFromNodes(frontNodes)),
  );
  const strippedBack = hoistParagraphImages(
    stripMathHastAliases(stripObsidianCommentsFromNodes(backNodes)),
  );
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
