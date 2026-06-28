import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMarkdown } from "../../src/ast/processor";
import {
  getCardDeclarationHeadingLevel,
  stripFrontmatter,
} from "../../src/io/frontmatterFilter";
import { extractCards } from "../../src/parser/stateMachine";
import { nodesToPreview } from "../../src/utils/textPreview";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");
const DEFAULT_DELIMITER = ":::";
const H4 = { cardDeclarationHeadingLevel: 4 as const };

async function loadFixtureCards(name: string, delimiter = DEFAULT_DELIMITER) {
  const rawText = await readFile(join(FIXTURES_DIR, `${name}.md`), "utf8");
  const ast = parseMarkdown(stripFrontmatter(rawText), "/vault");
  const level = getCardDeclarationHeadingLevel(rawText, 4);
  return extractCards(ast, delimiter, { cardDeclarationHeadingLevel: level });
}

describe("stateMachine", () => {
  test("extracts tag from heading and splits front/back at delimiter", () => {
    const rawText = "### Algorithms\n\nWhat is DFS? ::: Depth-first search.";
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.tag).toBe("Algorithms");
    expect(cards[0]?.frontNodes.length).toBeGreaterThan(0);
    expect(cards[0]?.backNodes.length).toBeGreaterThan(0);
  });

  test("extracts multiple cards from one file", () => {
    const rawText = [
      "### Topic A",
      "",
      "Front A ::: Back A",
      "",
      "### Topic B",
      "",
      "Front B ::: Back B",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.tag).toBe("Topic A");
    expect(cards[1]?.tag).toBe("Topic B");
  });

  test("ends card when encountering equal or higher depth heading", () => {
    const rawText = [
      "#### Subtopic",
      "",
      "Front ::: Back",
      "",
      "### New Section",
      "",
      "Other front ::: Other back",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.tag).toBe("Subtopic");
    expect(cards[1]?.tag).toBe("New Section");
  });

  test("ignores delimiter inside code per fixture", async () => {
    const fixture = await readFile(
      join(import.meta.dir, "../fixtures/edge-case-delimiters-in-code.md"),
      "utf8",
    );
    const ast = parseMarkdown(fixture, "/vault");
    const cards = extractCards(ast, "?");

    expect(cards).toHaveLength(1);
    expect(cards[0]?.frontNodes.length).toBeGreaterThan(0);
    expect(cards[0]?.backNodes.length).toBeGreaterThan(0);
  });

  test("ignores ::: inside code per triple-colon fixture", async () => {
    const fixture = await readFile(
      join(import.meta.dir, "../fixtures/edge-case-delimiters-triple-colon.md"),
      "utf8",
    );
    const ast = parseMarkdown(fixture, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.frontNodes.length).toBeGreaterThan(0);
    expect(cards[0]?.backNodes.length).toBeGreaterThan(0);
    expect(nodesToPreview(cards[0]!.backNodes)).toContain("should start the back");
  });

  test("parses existing anki-id from html comment", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const rawText = `### Physics\n\nForce ::: 9.8 m/s^2\n<!--anki-id: ${uuid}-->`;
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.ankiId).toBe(uuid);
    expect(cards[0]?.injectionOffset).toBeUndefined();
  });

  test("sets injectionOffset after removing valid anki-id but leaving malformed comment", () => {
    const rawText = [
      "### Entropy",
      "",
      "Measure ::: Randomness.",
      "<!-- anki-id: -->",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.ankiId).toBeUndefined();
    expect(cards[0]?.injectionOffset).toBeTypeOf("number");
  });

  test("sets injectionOffset for cards without anki-id", () => {
    const rawText = "### Entropy\n\nMeasure ::: Randomness.";
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.ankiId).toBeUndefined();
    expect(cards[0]?.injectionOffset).toBeTypeOf("number");
  });

  test("stress-test-nested-complex fixture extracts one card ignoring code delimiter", async () => {
    const cards = await loadFixtureCards("stress-test-nested-complex");

    expect(cards).toHaveLength(1);
    expect(cards[0]?.tag).toBe("Distributed Systems::Message Broker");
    expect(cards[0]?.frontNodes.length).toBeGreaterThan(0);
    expect(cards[0]?.backNodes.length).toBeGreaterThan(0);
  });

  test("injection-required-no-ids fixture yields three cards without anki-id", async () => {
    const cards = await loadFixtureCards("injection-required-no-ids");

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.tag)).toEqual([
      "Thermodynamics and CS::Entropy",
      "Thermodynamics and CS::Depth-First Search",
      "Thermodynamics and CS::TCP Protocol",
    ]);
    for (const card of cards) {
      expect(card.ankiId).toBeUndefined();
      expect(card.injectionOffset).toBeTypeOf("number");
    }
  });

  test("malformed-boundary-headings fixture handles empty-back and heading-as-front cards", async () => {
    const cards = await loadFixtureCards("malformed-boundary-headings");

    expect(cards).toHaveLength(3);
    expect(cards[0]?.tag).toBe("Edge Cases::Empty Back");
    expect(cards[0]?.injectionOffset).toBeTypeOf("number");
    expect(cards[1]?.tag).toBe("Edge Cases::Declaration As Front");
    expect(cards[2]?.tag).toBe("Edge Cases::Normal Card After Edge Cases");
  });

  test("malformed-html-comments fixture treats empty anki-id as missing", async () => {
    const cards = await loadFixtureCards("malformed-html-comments");

    expect(cards).toHaveLength(1);
    expect(cards[0]?.tag).toBe("Mechanics::Gravitational Acceleration");
    expect(cards[0]?.ankiId).toBeUndefined();
    expect(cards[0]?.injectionOffset).toBeTypeOf("number");
  });

  test("multi-line-card-layout fixture covers separate front, heading-as-front, and tag paths", async () => {
    const cards = await loadFixtureCards("multi-line-card-layout");

    expect(cards).toHaveLength(4);
    expect(cards[0]?.tag).toBe("Computer Science::Card With Separate Front");
    expect(nodesToPreview(cards[0]!.frontNodes)).toContain("entropy in thermodynamics");
    expect(nodesToPreview(cards[0]!.backNodes)).toContain("microstates");

    expect(cards[1]?.tag).toBe("Computer Science::Heading Is The Front");
    expect(nodesToPreview(cards[1]!.frontNodes)).toContain("Heading Is The Front");
    expect(nodesToPreview(cards[1]!.backNodes)).toContain("Dijkstra");

    expect(cards[2]?.tag).toBe(
      "Computer Science::Graph Algorithms::Shortest Path Without Separate Front",
    );
    expect(nodesToPreview(cards[2]!.frontNodes)).toContain(
      "Shortest Path Without Separate Front",
    );

    expect(cards[3]?.tag).toBe(
      "Computer Science::Graph Algorithms::Another Card In Subsection",
    );
    expect(nodesToPreview(cards[3]!.frontNodes)).toContain("spanning tree");
    expect(nodesToPreview(cards[3]!.backNodes)).toContain("minimum spanning tree");
  });

  test("extracts multi-line front and back at H4 declaration level", () => {
    const rawText = [
      "# CS101",
      "",
      "#### Entropy",
      "",
      "What is entropy?",
      "",
      "It measures disorder.",
      "",
      ":::",
      "",
      "A statistical measure of microstates.",
      "",
      "Often called disorder.",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER, H4);

    expect(cards).toHaveLength(1);
    expect(nodesToPreview(cards[0]!.frontNodes)).toContain("What is entropy");
    expect(nodesToPreview(cards[0]!.frontNodes)).toContain("It measures disorder");
    expect(nodesToPreview(cards[0]!.backNodes)).toContain("statistical measure");
    expect(nodesToPreview(cards[0]!.backNodes)).toContain("disorder");
  });

  test("builds declaration-only tag when parent headers are excluded", () => {
    const rawText = [
      "# CS101",
      "",
      "### Week 2",
      "",
      "#### Entropy",
      "",
      "Define entropy.",
      ":::",
      "Measure of disorder.",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER, {
      ...H4,
      includeParentHeadersAsTags: false,
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.tag).toBe("Entropy");
  });

  test("builds joined tag path from H1, H3, and H4 headings", () => {
    const rawText = [
      "# CS101",
      "",
      "### Week 2",
      "",
      "#### Entropy",
      "",
      "Define entropy.",
      ":::",
      "Measure of disorder.",
      "",
      "#### Enthalpy",
      "",
      "Define enthalpy.",
      ":::",
      "Heat content at constant pressure.",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER, H4);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.tag).toBe("CS101::Week 2::Entropy");
    expect(cards[1]?.tag).toBe("CS101::Week 2::Enthalpy");
  });

  test("uses declaration heading as front when delimiter is on the next line", () => {
    const rawText = [
      "# CS101",
      "",
      "#### What is TCP?",
      "",
      ":::",
      "",
      "Transmission Control Protocol.",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER, H4);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.tag).toBe("CS101::What is TCP?");
    expect(nodesToPreview(cards[0]!.frontNodes)).toContain("What is TCP");
    expect(nodesToPreview(cards[0]!.backNodes)).toContain("Transmission Control");
  });

  test("updates tag prefix when H3 subsection changes mid-document", () => {
    const rawText = [
      "# CS101",
      "",
      "### Week 1",
      "",
      "#### Card A",
      ":::",
      "Back A",
      "",
      "### Week 2",
      "",
      "#### Card B",
      ":::",
      "Back B",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER, H4);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.tag).toBe("CS101::Week 1::Card A");
    expect(cards[1]?.tag).toBe("CS101::Week 2::Card B");
  });

  test("does not start cards from H1 or H3 headings alone", () => {
    const rawText = [
      "# Org Name",
      "",
      "Intro prose without a card.",
      "",
      "### Sub-section",
      "",
      "More organizational prose.",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER, H4);

    expect(cards).toHaveLength(0);
  });

  test("finalizes card when encountering parent heading during an open card", () => {
    const rawText = [
      "# CS101",
      "",
      "#### Card One",
      "",
      "Front line one.",
      "",
      "### Week 2",
      "",
      "This prose belongs to Week 2, not Card One.",
      "",
      ":::",
      "",
      "Back line one.",
      "",
      "#### Card Two",
      "",
      ":::",
      "",
      "Back two.",
    ].join("\n");
    const ast = parseMarkdown(rawText, "/vault");
    const cards = extractCards(ast, DEFAULT_DELIMITER, H4);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.tag).toBe("CS101::Card One");
    expect(nodesToPreview(cards[0]!.frontNodes)).toBe("Front line one.");
    expect(nodesToPreview(cards[0]!.backNodes)).toBe("");
    expect(cards[1]?.tag).toBe("CS101::Week 2::Card Two");
  });
});
