import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildFootnoteScopeIndex } from "../../src/ast/footnoteScopeIndex";
import { parseMarkdown } from "../../src/ast/processor";
import {
  getCardDeclarationHeadingLevel,
  stripFrontmatter,
} from "../../src/io/frontmatterFilter";
import { extractCards } from "../../src/parser/stateMachine";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

async function loadScopedFixture() {
  const rawText = await readFile(
    join(FIXTURES_DIR, "card-footnotes-scoped.md"),
    "utf8",
  );
  const ast = parseMarkdown(stripFrontmatter(rawText), "/vault");
  const level = getCardDeclarationHeadingLevel(rawText, 4);
  const cards = extractCards(ast, ":::", { cardDeclarationHeadingLevel: level });
  const index = buildFootnoteScopeIndex(ast, level, 0);
  return { cards, index };
}

describe("footnoteScopeIndex", () => {
  test("resolves section-scoped shared footnote for Card A", async () => {
    const { cards, index } = await loadScopedFixture();
    const cardA = cards.find((c) => c.tag.endsWith("Card A"));
    expect(cardA).toBeDefined();

    const inherited = index.resolveForCard(cardA!);
    expect(inherited.has("SHARED")).toBe(true);
    expect(inherited.get("SHARED")?.children[0]).toMatchObject({
      type: "paragraph",
    });
  });

  test("does not leak footnotes from a different chapter", async () => {
    const { cards, index } = await loadScopedFixture();
    const cardA = cards.find((c) => c.tag.endsWith("Card A"));
    const inherited = index.resolveForCard(cardA!);
    expect(inherited.has("OTHER")).toBe(false);
  });

  test("card-local definition overrides inherited id on Card B", async () => {
    const { cards, index } = await loadScopedFixture();
    const cardB = cards.find((c) => c.tag.endsWith("Card B"));
    expect(cardB).toBeDefined();

    const inherited = index.resolveForCard(cardB!);
    expect(inherited.has("SHARED")).toBe(true);
    expect(inherited.has("WEEK")).toBe(false);
  });

  test("resolves chapter-level footnote for Card C in other chapter", async () => {
    const { cards, index } = await loadScopedFixture();
    const cardC = cards.find((c) => c.tag.endsWith("Card C"));
    expect(cardC).toBeDefined();

    const inherited = index.resolveForCard(cardC!);
    expect(inherited.has("OTHER")).toBe(true);
    expect(inherited.has("SHARED")).toBe(false);
  });
});
