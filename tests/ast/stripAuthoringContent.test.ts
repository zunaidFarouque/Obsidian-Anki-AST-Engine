import { describe, expect, test } from "bun:test";
import { compileCardFields } from "../../src/ast/cardCompiler";
import { parseMarkdown } from "../../src/ast/processor";
import {
  contentEndOffsetFromNodes,
  isAuthoringHtmlNode,
  stripAuthoringHtmlFromNodes,
  stripTrailingAuthoringNodes,
} from "../../src/ast/stripAuthoringContent";
import { extractCards } from "../../src/parser/stateMachine";

const ANKI_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("stripAuthoringContent", () => {
  test("isAuthoringHtmlNode matches expect comments but not anki-id", () => {
    const ast = parseMarkdown(
      [
        "<!-- expect: sync -->",
        `<!--anki-id: ${ANKI_ID}-->`,
      ].join("\n"),
      "/vault",
    );
    const expectNode = ast.children[0]!;
    const ankiIdNode = ast.children[1]!;

    expect(isAuthoringHtmlNode(expectNode)).toBe(true);
    expect(isAuthoringHtmlNode(ankiIdNode)).toBe(false);
  });

  test("stripTrailingAuthoringNodes removes trailing expect and block comments", () => {
    const ast = parseMarkdown(
      [
        "Answer line",
        "",
        "<!-- expect: sync; rules: BAS-01 -->",
      ].join("\n"),
      "/vault",
    );

    const stripped = stripTrailingAuthoringNodes(ast.children);
    expect(stripped).toHaveLength(1);
    expect(stripped[0]?.type).toBe("paragraph");
  });

  test("stripTrailingAuthoringNodes keeps trailing anki-id for binding", () => {
    const ast = parseMarkdown(
      [
        "Answer line",
        "",
        `<!--anki-id: ${ANKI_ID}-->`,
      ].join("\n"),
      "/vault",
    );

    const stripped = stripTrailingAuthoringNodes(ast.children);
    expect(stripped).toHaveLength(2);
    expect(stripped[1]?.type).toBe("html");
  });

  test("contentEndOffsetFromNodes ends before anki-id and expect comments", () => {
    const raw = [
      "Answer line",
      "",
      `<!--anki-id: ${ANKI_ID}-->`,
    ].join("\n");
    const ast = parseMarkdown(raw, "/vault");
    const answerEnd = raw.indexOf("Answer line") + "Answer line".length;

    expect(contentEndOffsetFromNodes(ast.children, 0)).toBe(answerEnd);
  });

  test("stripAuthoringHtmlFromNodes removes authoring html anywhere in the list", () => {
    const ast = parseMarkdown(
      [
        "Front",
        "<!-- expect: sync -->",
        "More",
      ].join("\n"),
      "/vault",
    );

    const stripped = stripAuthoringHtmlFromNodes(ast.children);
    expect(stripped).toHaveLength(2);
    expect(stripped.every((node) => !isAuthoringHtmlNode(node))).toBe(true);
  });

  test("compileCardFields omits trailing expect html from backHtml", () => {
    const rawText = [
      "#### Card",
      "",
      "Question",
      "",
      ":::",
      "",
      "Answer",
      "",
      "<!-- expect: sync; rules: BAS-01 -->",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, ":::", { cardDeclarationHeadingLevel: 4 });
    const { backHtml } = compileCardFields(cards[0]!.frontNodes, cards[0]!.backNodes);

    expect(backHtml).toBe("<p>Answer</p>");
    expect(backHtml).not.toContain("expect:");
    expect(backHtml).not.toContain("<!--");
  });
});
