import { describe, expect, test } from "bun:test";
import { compileCardFields, compileCardField } from "../../src/ast/cardCompiler";
import { parseMarkdown } from "../../src/ast/processor";
import { extractCards } from "../../src/parser/stateMachine";
import {
  stripObsidianCommentsFromNodes,
  stripObsidianCommentsFromText,
} from "../../src/ast/remarkObsidianComment";

describe("remarkObsidianComment", () => {
  test("stripObsidianCommentsFromText removes inline comments", () => {
    expect(stripObsidianCommentsFromText("Hello %% secret %% world")).toBe(
      "Hello  world",
    );
  });

  test("stripObsidianCommentsFromText removes multiline comment in one block", () => {
    expect(
      stripObsidianCommentsFromText("%%\nline one\nline two\n%%"),
    ).toBe("");
  });

  test("stripObsidianCommentsFromNodes removes comment-only paragraphs", () => {
    const ast = parseMarkdown(
      ["Answer", "", "%%", "draft note", "%%", "", "More"].join("\n"),
      "/vault",
    );

    const stripped = stripObsidianCommentsFromNodes(ast.children);
    const text = stripped
      .filter((node) => node.type === "paragraph")
      .map((node) =>
        "children" in node
          ? node.children.map((child) => ("value" in child ? child.value : "")).join("")
          : "",
      );

    expect(text).toEqual(["Answer", "More"]);
  });

  test("stripObsidianCommentsFromNodes removes comments spanning paragraphs", () => {
    const ast = parseMarkdown("%% line1\n\nline2 %%", "/vault");
    const stripped = stripObsidianCommentsFromNodes(ast.children);
    expect(stripped).toHaveLength(0);
  });

  test("stripObsidianCommentsFromNodes keeps visible text before and after block comments", () => {
    const ast = parseMarkdown(
      ["before %% mid", "", "comment", "", "%% after"].join("\n"),
      "/vault",
    );
    const stripped = stripObsidianCommentsFromNodes(ast.children);
    const text = stripped
      .filter((node) => node.type === "paragraph")
      .map((node) =>
        "children" in node
          ? node.children.map((child) => ("value" in child ? child.value : "")).join("")
          : "",
      );

    expect(text).toEqual(["before", "after"]);
  });

  test("stripObsidianCommentsFromNodes leaves code blocks unchanged", () => {
    const ast = parseMarkdown("```\n%% not a comment %%\n```", "/vault");
    const stripped = stripObsidianCommentsFromNodes(ast.children);

    expect(stripped).toHaveLength(1);
    expect(stripped[0]?.type).toBe("code");
    if (stripped[0]?.type === "code") {
      expect(stripped[0].value).toContain("%%");
    }
  });

  test("compileCardFields omits obsidian comments from anki html", () => {
    const rawText = [
      "#### Card",
      "",
      "Question %% organizer note %% text",
      "",
      ":::",
      "",
      "Answer",
      "",
      "%%",
      "remember to tighten this",
      "%%",
      "",
      "Final sentence.",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, ":::", { cardDeclarationHeadingLevel: 4 });
    const { frontHtml, backHtml } = compileCardFields(
      cards[0]!.frontNodes,
      cards[0]!.backNodes,
    );

    expect(frontHtml).toBe("<p>Question  text</p>");
    expect(frontHtml).not.toContain("%%");
    expect(backHtml).toBe("<p>Answer</p>\n<p>Final sentence.</p>");
    expect(backHtml).not.toContain("remember");
  });
});
