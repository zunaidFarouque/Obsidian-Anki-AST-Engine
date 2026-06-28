import { describe, expect, test } from "bun:test";
import type { Content } from "mdast";
import { stripTrailingSectionSeparators } from "../../src/parser/stripTrailingSectionSeparators";

const ANKI_ID_HTML: Content = {
  type: "html",
  value: "<!--anki-id: 550e8400-e29b-41d4-a716-446655440000-->",
};

const PARAGRAPH: Content = {
  type: "paragraph",
  children: [{ type: "text", value: "Answer text." }],
};

const RULE: Content = {
  type: "thematicBreak",
};

describe("stripTrailingSectionSeparators", () => {
  test("removes one trailing thematic break before anki-id html", () => {
    expect(stripTrailingSectionSeparators([PARAGRAPH, RULE, ANKI_ID_HTML])).toEqual([
      PARAGRAPH,
      ANKI_ID_HTML,
    ]);
  });

  test("removes multiple trailing thematic breaks", () => {
    expect(
      stripTrailingSectionSeparators([PARAGRAPH, RULE, RULE, ANKI_ID_HTML]),
    ).toEqual([PARAGRAPH, ANKI_ID_HTML]);
  });

  test("removes trailing thematic breaks without anki-id html", () => {
    expect(stripTrailingSectionSeparators([PARAGRAPH, RULE, RULE])).toEqual([
      PARAGRAPH,
    ]);
  });

  test("keeps thematic breaks that are not trailing", () => {
    const middleRule: Content = { type: "thematicBreak" };
    const tail: Content = {
      type: "paragraph",
      children: [{ type: "text", value: "After rule." }],
    };

    expect(
      stripTrailingSectionSeparators([PARAGRAPH, middleRule, tail]),
    ).toEqual([PARAGRAPH, middleRule, tail]);
  });
});
