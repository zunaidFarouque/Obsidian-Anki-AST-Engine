import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMarkdown } from "../../src/ast/processor";
import {
  findDelimiterIndex,
  findDelimiterMatch,
  isStructuralDelimiter,
} from "../../src/parser/delimiterCheck";
import type { Node } from "unist";
import { visitParents } from "unist-util-visit-parents";

describe("delimiterCheck", () => {
  test("treats only block-level delimiter as structural in code fixture", async () => {
    const fixture = await readFile(
      join(import.meta.dir, "../fixtures/edge-case-delimiters-in-code.md"),
      "utf8",
    );
    const ast = parseMarkdown(fixture, "/vault");
    const delimiter = "?";

    const matches = collectDelimiterMatches(ast, delimiter);
    const structural = matches.filter((match) =>
      isStructuralDelimiter(match.node, match.ancestors, delimiter),
    );

    expect(matches).toHaveLength(1);
    expect(structural).toHaveLength(1);
    expect(getText(structural[0]!.node)).toContain("? It is a shorthand");
  });

  test("returns false when text node has inlineCode ancestor", () => {
    const textNode: Node = { type: "text", value: "a ? b" };
    const inlineCode: Node = {
      type: "inlineCode",
      value: "a ? b",
      children: [textNode],
    };

    expect(isStructuralDelimiter(textNode, [inlineCode], "?")).toBe(false);
  });

  test("returns false when text node has code ancestor", () => {
    const textNode: Node = { type: "text", value: "a ? b" };
    const codeBlock: Node = {
      type: "code",
      lang: "js",
      value: "a ? b",
      children: [textNode],
    };

    expect(isStructuralDelimiter(textNode, [codeBlock], "?")).toBe(false);
  });

  test("returns true for standalone delimiter at block level", () => {
    const ast = parseMarkdown("### Tag\n\nFront? Back", "/vault");
    const match = findFirstTextWith(ast, "?");
    expect(
      isStructuralDelimiter(match!.node, match!.ancestors, "?"),
    ).toBe(true);
  });

  test("returns false for question marks at end of front text", () => {
    const textNode: Node = { type: "text", value: "What is entropy?" };
    expect(isStructuralDelimiter(textNode, [], "?")).toBe(false);
  });

  test("treats only block-level ::: as structural in triple-colon fixture", async () => {
    const fixture = await readFile(
      join(import.meta.dir, "../fixtures/edge-case-delimiters-triple-colon.md"),
      "utf8",
    );
    const ast = parseMarkdown(fixture, "/vault");
    const delimiter = ":::";

    const matches = collectDelimiterMatches(ast, delimiter);
    const structural = matches.filter((match) =>
      isStructuralDelimiter(match.node, match.ancestors, delimiter),
    );

    expect(matches).toHaveLength(1);
    expect(structural).toHaveLength(1);
    expect(getText(structural[0]!.node).trim()).toBe(":::");
  });

  test("returns false when text node has inlineCode ancestor for :::", () => {
    const textNode: Node = { type: "text", value: "foo:::bar" };
    const inlineCode: Node = {
      type: "inlineCode",
      value: "foo:::bar",
      children: [textNode],
    };

    expect(isStructuralDelimiter(textNode, [inlineCode], ":::")).toBe(false);
  });

  test("returns true for standalone ::: at block level", () => {
    const ast = parseMarkdown("### Tag\n\nFront\n\n:::\n\nBack", "/vault");
    const match = findFirstTextWith(ast, ":::");
    expect(
      isStructuralDelimiter(match!.node, match!.ancestors, ":::"),
    ).toBe(true);
  });

  test("returns true for inline ::: split", () => {
    const textNode: Node = { type: "text", value: "Front ::: Back" };
    expect(isStructuralDelimiter(textNode, [], ":::")).toBe(true);
  });

  test("returns false for double-colon prose without triple colon", () => {
    const textNode: Node = { type: "text", value: "CS101::Week 2::Entropy" };
    expect(isStructuralDelimiter(textNode, [], ":::")).toBe(false);
  });

  test("returns false when text node has math ancestor", () => {
    const textNode: Node = { type: "text", value: "x ::: y" };
    const mathBlock: Node = {
      type: "math",
      value: "x ::: y",
      children: [textNode],
    };

    expect(isStructuralDelimiter(textNode, [mathBlock], ":::")).toBe(false);
  });

  test("treats delimiter inside display math as non-structural in math fixture", async () => {
    const fixture = await readFile(
      join(import.meta.dir, "../fixtures/edge-case-delimiters-in-math.md"),
      "utf8",
    );
    const ast = parseMarkdown(fixture, "/vault");
    const delimiter = ":::";

    const matches = collectDelimiterMatches(ast, delimiter);
    const structural = matches.filter((match) =>
      isStructuralDelimiter(match.node, match.ancestors, delimiter),
    );

    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(structural).toHaveLength(1);
    expect(getText(structural[0]!.node).trim()).toBe(":::");
  });

  test(":::r match consumes the r suffix so Back is not polluted", () => {
    const match = findDelimiterMatch(":::r", ":::");
    expect(match).toEqual({ index: 0, length: 4 });
    expect(findDelimiterIndex(":::r", ":::")).toBe(0);
  });

  test(":::t match consumes the t suffix so Back is not polluted", () => {
    const match = findDelimiterMatch(":::t", ":::");
    expect(match).toEqual({ index: 0, length: 4 });
  });

  test("plain ::: still matches length 3", () => {
    expect(findDelimiterMatch(":::", ":::")).toEqual({ index: 0, length: 3 });
    expect(findDelimiterMatch("Front ::: Back", ":::")).toEqual({
      index: 6,
      length: 3,
    });
  });
});

type DelimiterMatch = {
  node: Node;
  ancestors: Node[];
};

function collectDelimiterMatches(root: Node, delimiter: string): DelimiterMatch[] {
  const matches: DelimiterMatch[] = [];
  visitParents(root, (node, ancestors) => {
    if (node.type === "text" && "value" in node && node.value.includes(delimiter)) {
      matches.push({ node, ancestors: [...ancestors] });
    }
  });
  return matches;
}

function findFirstTextWith(
  root: Node,
  delimiter: string,
): DelimiterMatch | undefined {
  return collectDelimiterMatches(root, delimiter)[0];
}

function getText(node: Node): string {
  return "value" in node && typeof node.value === "string" ? node.value : "";
}
