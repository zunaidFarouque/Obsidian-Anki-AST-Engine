import { describe, expect, test } from "bun:test";
import {
  buildFrontDuplicateSearchQuery,
  stripHtmlForSearch,
} from "../../src/anki/frontSearch";

describe("frontSearch", () => {
  test("stripHtmlForSearch removes tags and collapses whitespace", () => {
    expect(stripHtmlForSearch("<p>What is <strong>TCP</strong>?</p>")).toBe(
      "What is TCP ?",
    );
  });

  test("buildFrontDuplicateSearchQuery scopes to deck and front field", () => {
    expect(
      buildFrontDuplicateSearchQuery(
        "Synced from Obsidian",
        "<p>What is TCP?</p>",
      ),
    ).toBe('deck:"Synced from Obsidian" front:"What is TCP?"');
  });

  test("buildFrontDuplicateSearchQuery escapes quotes in deck and text", () => {
    expect(
      buildFrontDuplicateSearchQuery('Deck "A"', '<p>Say "hi"</p>'),
    ).toBe('deck:"Deck \\"A\\"" front:"Say \\"hi\\""');
  });
});
