import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { compileCardField, compileCardFields } from "../../src/ast/cardCompiler";
import { parseMarkdown } from "../../src/ast/processor";
import {
  getCardDeclarationHeadingLevel,
  stripFrontmatter,
} from "../../src/io/frontmatterFilter";
import { extractCards } from "../../src/parser/stateMachine";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");
const DEFAULT_DELIMITER = ":::";

async function loadFixtureCards(name: string, delimiter = DEFAULT_DELIMITER) {
  const rawText = await readFile(join(FIXTURES_DIR, `${name}.md`), "utf8");
  const ast = parseMarkdown(stripFrontmatter(rawText), "/vault");
  const level = getCardDeclarationHeadingLevel(rawText, 4);
  return extractCards(ast, delimiter, { cardDeclarationHeadingLevel: level });
}

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) ?? []).length;
}

describe("cardCompiler", () => {
  test("compileCardField preserves separate paragraphs on the front", async () => {
    const cards = await loadFixtureCards("card-rich-formatting");
    expect(cards).toHaveLength(1);

    const frontHtml = compileCardField(cards[0]!.frontNodes);

    expect(countMatches(frontHtml, /<p>/g)).toBeGreaterThanOrEqual(2);
    expect(frontHtml).toContain("entropy in thermodynamics");
    expect(frontHtml).toContain("dispersed energy");
    expect(frontHtml).not.toMatch(
      /thermodynamics\?It measures|thermodynamics\?<\/p><p>It measures/,
    );
  });

  test("compileCardField renders soft line breaks as br", async () => {
    const cards = await loadFixtureCards("card-rich-formatting");
    const frontHtml = compileCardField(cards[0]!.frontNodes);

    expect(frontHtml).toContain("<br>");
    expect(frontHtml).toContain("Line one");
    expect(frontHtml).toContain("Line two");
  });

  test("compileCardField renders emphasis, table, hr, highlight, and preview heading on back", async () => {
    const cards = await loadFixtureCards("card-rich-formatting");
    const backHtml = compileCardField(cards[0]!.backNodes);

    expect(backHtml).toMatch(/<h2[^>]*>.*Preview section title/s);
    expect(backHtml).toContain("<strong>bold</strong>");
    expect(backHtml).toContain("<em>italic</em>");
    expect(backHtml).toContain("<table>");
    expect(backHtml).toContain("<hr>");
    expect(backHtml).toContain("<mark>highlighted</mark>");
    expect(backHtml).toContain("<pre>");
    expect(backHtml).toContain('print(":::")');
  });

  test("multi-line-card-layout front keeps paragraph structure", async () => {
    const cards = await loadFixtureCards("multi-line-card-layout");
    const entropyCard = cards.find((card) =>
      card.frontNodes.some(
        (node) =>
          node.type === "paragraph" &&
          "children" in node &&
          node.children.some(
            (child) => child.type === "text" && child.value.includes("entropy"),
          ),
      ),
    );
    expect(entropyCard).toBeDefined();

    const frontHtml = compileCardField(entropyCard!.frontNodes);

    expect(countMatches(frontHtml, /<p>/g)).toBeGreaterThanOrEqual(2);
    expect(frontHtml).toContain("entropy in thermodynamics");
    expect(frontHtml).toContain("dispersed energy");
  });

  test("compileCardField renders inline and display math with MathJax", async () => {
    const cards = await loadFixtureCards("card-math");
    expect(cards).toHaveLength(1);

    const backHtml = compileCardField(cards[0]!.backNodes);

    expect(backHtml).not.toContain("$E=mc^2$");
    expect(backHtml).toMatch(/mjx-container|E=mc|mc\^2/i);
    expect(backHtml).toContain("F");
  });

  test("card-math fixture keeps delimiter inside display math from splitting card", async () => {
    const cards = await loadFixtureCards("card-math");
    expect(cards).toHaveLength(1);
    expect(cards[0]!.backNodes.length).toBeGreaterThan(0);
  });

  test("compileCardField renders Obsidian callouts as styled divs", async () => {
    const cards = await loadFixtureCards("card-callouts");
    const backHtml = compileCardField(cards[0]!.backNodes);

    expect(backHtml).toContain('class="callout callout-note"');
    expect(backHtml).toContain('class="callout callout-warning"');
    expect(backHtml).toContain('class="callout-title"');
    expect(backHtml).toContain("Custom title");
    expect(backHtml).toContain("note callout body");
    expect(backHtml).toContain("Warning body continues");
    expect(backHtml).toContain("Regular paragraph after callouts");
  });

  test("compileCardFields embeds footnotes at bottom of back with shared numbering", async () => {
    const cards = await loadFixtureCards("card-footnotes");
    expect(cards).toHaveLength(1);

    const { frontHtml, backHtml } = compileCardFields(
      cards[0]!.frontNodes,
      cards[0]!.backNodes,
    );

    expect(frontHtml).toContain("<sup>1</sup>");
    expect(frontHtml).toContain("<sup>2</sup>");
    expect(frontHtml).not.toContain("<hr>");
    expect(frontHtml).not.toContain("Source citation");

    expect(backHtml).toContain("Answer body cites");
    expect(backHtml).toContain("<sup>1</sup>");
    expect(backHtml).toContain("<hr>");
    expect(backHtml).toContain("Source citation at bottom");
    expect(backHtml).toContain("Additional note for numbering");
    expect(backHtml).not.toContain("[^src]:");
  });
});
