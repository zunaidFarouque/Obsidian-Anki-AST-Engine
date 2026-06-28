import { describe, expect, test } from "bun:test";
import {
  buildExcludedCardKeysFromWarnings,
  cardExclusionKey,
  detectVaultFrontCollisions,
  type DuplicateCardSource,
  type DuplicateWarning,
} from "../../src/anki/duplicateDetect";

function source(
  overrides: Partial<DuplicateCardSource> & Pick<DuplicateCardSource, "file" | "tag">,
): DuplicateCardSource {
  return {
    deck: "Test::Deck",
    frontHtml: "<p>Same front</p>",
    backHtml: "<p>Same back</p>",
    ...overrides,
  };
}

describe("detectVaultFrontCollisions", () => {
  test("returns no warnings for unique fronts", () => {
    const warnings = detectVaultFrontCollisions([
      source({ file: "a.md", tag: "A::One", frontHtml: "<p>One</p>" }),
      source({ file: "b.md", tag: "B::Two", frontHtml: "<p>Two</p>" }),
    ]);

    expect(warnings).toEqual([]);
  });

  test("reports vault_front_collision when same front appears in multiple files with same back", () => {
    const warnings = detectVaultFrontCollisions([
      source({ file: "notes/a.md", tag: "Physics::Entropy" }),
      source({ file: "notes/b.md", tag: "Chemistry::Entropy" }),
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.kind).toBe("vault_front_collision");
    expect(warnings[0]?.sources).toHaveLength(2);
    expect(warnings[0]?.message).toContain("same Front HTML");
  });

  test("reports back_mismatch when same front has different backs", () => {
    const warnings = detectVaultFrontCollisions([
      source({
        file: "stress.md",
        tag: "Feature::Heading",
        backHtml: "<p>Answer A</p>",
      }),
      source({
        file: "other.md",
        tag: "CS::Heading",
        backHtml: "<p>Answer B</p>",
      }),
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.kind).toBe("back_mismatch");
    expect(warnings[0]?.message).toContain("different Back HTML");
  });

  test("groups collisions per deck and front, not across decks", () => {
    const warnings = detectVaultFrontCollisions([
      source({ file: "a.md", tag: "A", deck: "Deck A" }),
      source({ file: "b.md", tag: "B", deck: "Deck B" }),
    ]);

    expect(warnings).toEqual([]);
  });
});

describe("cardExclusionKey", () => {
  test("builds a stable key from file, tag, deck, and frontHtml", () => {
    const key = cardExclusionKey(
      "notes/a.md",
      "Physics::Entropy",
      "Test::Deck",
      "<p>Same front</p>",
    );
    expect(key).toContain("notes/a.md");
    expect(key).toContain("Physics::Entropy");
    expect(key).toContain("Test::Deck");
    expect(key).toContain("<p>Same front</p>");
  });
});

describe("buildExcludedCardKeysFromWarnings", () => {
  test("collects keys for vault collision and back mismatch sources only", () => {
    const collisionWarnings = detectVaultFrontCollisions([
      source({ file: "a.md", tag: "A::One" }),
      source({ file: "b.md", tag: "B::Two" }),
    ]);
    const relinkWarning: DuplicateWarning = {
      kind: "anki_duplicate_recovered",
      deck: "Test::Deck",
      frontHtml: "<p>Same front</p>",
      message: "recovered",
      sources: [{ file: "c.md", tag: "C", backHtml: "<p>back</p>" }],
      ankiNoteId: 42,
    };

    const keys = buildExcludedCardKeysFromWarnings([
      ...collisionWarnings,
      relinkWarning,
    ]);

    expect(keys.size).toBe(2);
    expect(
      keys.has(
        cardExclusionKey(
          "a.md",
          "A::One",
          "Test::Deck",
          "<p>Same front</p>",
        ),
      ),
    ).toBe(true);
    expect(
      keys.has(
        cardExclusionKey(
          "b.md",
          "B::Two",
          "Test::Deck",
          "<p>Same front</p>",
        ),
      ),
    ).toBe(true);
  });
});
