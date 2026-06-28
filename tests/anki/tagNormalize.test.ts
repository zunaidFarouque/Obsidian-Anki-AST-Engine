import { describe, expect, test } from "bun:test";
import {
  normalizeAnkiTagList,
  normalizeAnkiTagPath,
  normalizeAnkiTagSegment,
} from "../../src/anki/tagNormalize";

describe("tagNormalize", () => {
  test("normalizeAnkiTagSegment replaces spaces with underscores", () => {
    expect(normalizeAnkiTagSegment("Feature Stress Test")).toBe(
      "Feature_Stress_Test",
    );
    expect(normalizeAnkiTagSegment("Subsection B")).toBe("Subsection_B");
  });

  test("normalizeAnkiTagPath normalizes each hierarchical segment", () => {
    expect(
      normalizeAnkiTagPath(
        "Feature Stress Test::Subsection B::Transclusion On Back",
      ),
    ).toBe("Feature_Stress_Test::Subsection_B::Transclusion_On_Back");
  });

  test("normalizeAnkiTagPath leaves tags without spaces unchanged", () => {
    expect(normalizeAnkiTagPath("Obsidian-Anki-AST")).toBe("Obsidian-Anki-AST");
    expect(normalizeAnkiTagPath("obsidian-id::9e58efe4-cc6c-4004-8aab-eb0b06e1fe70")).toBe(
      "obsidian-id::9e58efe4-cc6c-4004-8aab-eb0b06e1fe70",
    );
  });

  test("normalizeAnkiTagList dedupes while preserving order", () => {
    expect(
      normalizeAnkiTagList([
        "Obsidian-Anki-AST",
        "exam-prep",
        "exam-prep",
        "Feature Stress Test::Entropy",
      ]),
    ).toEqual([
      "Obsidian-Anki-AST",
      "exam-prep",
      "Feature_Stress_Test::Entropy",
    ]);
  });
});
