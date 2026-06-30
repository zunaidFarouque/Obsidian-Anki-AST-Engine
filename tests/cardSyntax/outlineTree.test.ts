import { describe, expect, test } from "bun:test";
import type { Heading } from "mdast";
import { parseMarkdown } from "../../src/ast/processor";
import {
  buildOutlineFromAst,
  findNearestTypeDeclaration,
  getAncestorHeadings,
  type OutlineHeading,
  type TypeDeclaration,
} from "../../src/cardSyntax/outlineTree";

function typeTag(
  kind: TypeDeclaration["kind"],
  value: string,
): TypeDeclaration {
  return { kind, value };
}

function ancestorTexts(card: OutlineHeading): string[] {
  return getAncestorHeadings(card).map((h) => h.text);
}

function resolveFromAncestors(
  card: OutlineHeading,
  tags: Record<string, TypeDeclaration | undefined>,
): TypeDeclaration | undefined {
  return findNearestTypeDeclaration(getAncestorHeadings(card), (heading) => tags[heading.text]);
}

describe("outlineTree", () => {
  test("buildOutlineFromAst records card headings in document order", () => {
    const ast = parseMarkdown(
      [
        "### Unit A",
        "#### Card 1",
        "body",
        "#### Card 2",
        "more",
      ].join("\n"),
      "/vault",
    );

    const outline = buildOutlineFromAst(ast, 4);
    expect(outline.cardHeadings.map((h) => h.text)).toEqual(["Card 1", "Card 2"]);
  });

  test("getAncestorHeadings walks structural parents nearest first (H3→H2→H1)", () => {
    const ast = parseMarkdown(
      [
        "# Course",
        "## Chapter",
        "### Section",
        "#### Card",
        "body",
      ].join("\n"),
      "/vault",
    );

    const outline = buildOutlineFromAst(ast, 4);
    const card = outline.cardHeadings[0]!;

    expect(ancestorTexts(card)).toEqual(["Section", "Chapter", "Course"]);
    expect(getAncestorHeadings(card).map((h) => h.depth)).toEqual([3, 2, 1]);
  });

  test("RES-02: sibling sections do not inherit across outline branches", () => {
    const ast = parseMarkdown(
      [
        "### Unit A #anki/cardType/cloze",
        "#### Card 1",
        "{{foo}}",
        "",
        "## Unit B",
        "#### Card 2",
        "What is entropy?",
        ":::",
        "A measure of dispersal.",
      ].join("\n"),
      "/vault",
    );

    const outline = buildOutlineFromAst(ast, 4);
    const card1 = outline.cardHeadings.find((h) => h.text.startsWith("Card 1"))!;
    const card2 = outline.cardHeadings.find((h) => h.text.startsWith("Card 2"))!;

    expect(ancestorTexts(card1)).toEqual(["Unit A #anki/cardType/cloze"]);
    expect(ancestorTexts(card2)).toEqual(["Unit B"]);
    expect(ancestorTexts(card2)).not.toContain("Unit A #anki/cardType/cloze");

    const tags: Record<string, TypeDeclaration | undefined> = {
      "Unit A #anki/cardType/cloze": typeTag("cardType", "cloze"),
      "Unit B": undefined,
    };

    expect(resolveFromAncestors(card1, tags)).toEqual(typeTag("cardType", "cloze"));
    expect(resolveFromAncestors(card2, tags)).toBeUndefined();
  });

  test("RES-03: nearest ancestor with a type tag wins", () => {
    const ast = parseMarkdown(
      [
        "## Chapter #anki/cardType/basic",
        "### Section #anki/cardType/cloze",
        "#### Card",
        "{{hidden}}",
      ].join("\n"),
      "/vault",
    );

    const outline = buildOutlineFromAst(ast, 4);
    const card = outline.cardHeadings[0]!;

    expect(ancestorTexts(card)).toEqual([
      "Section #anki/cardType/cloze",
      "Chapter #anki/cardType/basic",
    ]);

    const tags: Record<string, TypeDeclaration | undefined> = {
      "Section #anki/cardType/cloze": typeTag("cardType", "cloze"),
      "Chapter #anki/cardType/basic": typeTag("cardType", "basic"),
    };

    expect(resolveFromAncestors(card, tags)).toEqual(typeTag("cardType", "cloze"));
  });

  test("findNearestTypeDeclaration returns undefined when no ancestor has a tag", () => {
    const ancestors: OutlineHeading[] = [
      { depth: 3, text: "Section", node: {} as Heading, ancestors: [] },
      { depth: 2, text: "Chapter", node: {} as Heading, ancestors: [] },
    ];

    expect(
      findNearestTypeDeclaration(ancestors, () => undefined),
    ).toBeUndefined();
  });

  test("findNearestTypeDeclaration skips ancestors without tags", () => {
    const ancestors: OutlineHeading[] = [
      { depth: 3, text: "Untagged section", node: {} as Heading, ancestors: [] },
      { depth: 2, text: "Tagged chapter", node: {} as Heading, ancestors: [] },
    ];

    const tags: Record<string, TypeDeclaration | undefined> = {
      "Untagged section": undefined,
      "Tagged chapter": typeTag("model", "Vocab"),
    };

    expect(findNearestTypeDeclaration(ancestors, (h) => tags[h.text])).toEqual(
      typeTag("model", "Vocab"),
    );
  });

  test("defaults cardDeclarationLevel to 4", () => {
    const ast = parseMarkdown("#### Default level card\nbody", "/vault");
    const outline = buildOutlineFromAst(ast);
    expect(outline.cardDeclarationLevel).toBe(4);
    expect(outline.cardHeadings).toHaveLength(1);
  });
});
