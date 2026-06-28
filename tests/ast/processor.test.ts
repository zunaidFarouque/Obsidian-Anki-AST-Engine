import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "../../src/ast/processor";

describe("processor", () => {
  test("parses headings, GFM table, and wikilinks with position data", () => {
    const rawText = [
      "### Algorithms",
      "",
      "| Col | Val |",
      "| --- | --- |",
      "| A   | 1   |",
      "",
      "See [[Related Note]] for more.",
    ].join("\n");

    const ast = parseMarkdown(rawText, "/vault");

    expect(ast.type).toBe("root");
    expect(ast.children.length).toBeGreaterThan(0);

    const heading = ast.children.find((node) => node.type === "heading");
    expect(heading).toBeDefined();
    expect(heading?.position?.start.offset).toBe(0);

    const table = ast.children.find((node) => node.type === "table");
    expect(table).toBeDefined();

    const wikiLink = findNode(ast, (node) => node.type === "wikiLink");
    expect(wikiLink).toBeDefined();
    expect(wikiLink?.position).toBeDefined();
  });
});

function findNode(
  node: { type: string; children?: unknown[] },
  predicate: (node: { type: string; children?: unknown[] }) => boolean,
): { type: string; position?: { start: { offset: number } } } | undefined {
  if (predicate(node)) {
    return node as { type: string; position?: { start: { offset: number } } };
  }

  if (!node.children) {
    return undefined;
  }

  for (const child of node.children) {
    const found = findNode(
      child as { type: string; children?: unknown[] },
      predicate,
    );
    if (found) {
      return found;
    }
  }

  return undefined;
}
