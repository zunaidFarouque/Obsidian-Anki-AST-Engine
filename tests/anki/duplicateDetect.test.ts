import { describe, expect, test } from "bun:test";
import {
  detectVaultFrontCollisions,
  type DuplicateCardSource,
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
