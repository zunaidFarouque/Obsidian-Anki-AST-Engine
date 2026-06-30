import { describe, expect, test } from "bun:test";
import { parseFrontmatter } from "../../src/io/frontmatterFilter";
import {
  BUILT_IN_CARD_TYPES,
  customDefaultAppliesRes04,
  effectiveBuiltInDefaultFm04,
  effectiveCustomNoteTypeFm04,
  parseAnkiCardDefaultFromFrontmatter,
  parseAnkiCustomCardDefaultFromFrontmatter,
  parseBuiltInCardDefault,
  parseCustomCardDefault,
  resolveFileDefaults,
  resolveFileDefaultsFromRaw,
  type FileDefaults,
} from "../../src/cardSyntax/frontmatterDefaults";

describe("frontmatterDefaults", () => {
  describe("FM-02 — anki_cardDefault", () => {
    test.each(BUILT_IN_CARD_TYPES)("parseBuiltInCardDefault accepts %s", (cardType) => {
      expect(parseBuiltInCardDefault(cardType)).toBe(cardType);
    });

    test("parseBuiltInCardDefault is case-insensitive", () => {
      expect(parseBuiltInCardDefault("Basic")).toBe("basic");
      expect(parseBuiltInCardDefault("CLOZE")).toBe("cloze");
    });

    test("parseBuiltInCardDefault unquotes YAML values", () => {
      expect(parseBuiltInCardDefault('"reversible"')).toBe("reversible");
      expect(parseBuiltInCardDefault("'typed'")).toBe("typed");
    });

    test("parseBuiltInCardDefault rejects unknown values", () => {
      expect(parseBuiltInCardDefault("Vocab")).toBeNull();
      expect(parseBuiltInCardDefault("")).toBeNull();
    });

    test("parseAnkiCardDefaultFromFrontmatter reads key case-insensitively", () => {
      expect(
        parseAnkiCardDefaultFromFrontmatter({ anki_cardDefault: "basic" }),
      ).toBe("basic");
      expect(
        parseAnkiCardDefaultFromFrontmatter({ ANKI_CARDDEFAULT: "cloze" }),
      ).toBe("cloze");
    });

    test("parseAnkiCardDefaultFromFrontmatter returns null when absent", () => {
      expect(parseAnkiCardDefaultFromFrontmatter({ AnkiSync: "on" })).toBeNull();
    });
  });

  describe("FM-03 — anki_customCardDefault", () => {
    test("parseCustomCardDefault trims and unquotes note type id", () => {
      expect(parseCustomCardDefault("Vocab")).toBe("Vocab");
      expect(parseCustomCardDefault('"My Vocab"')).toBe("My Vocab");
      expect(parseCustomCardDefault("  My_Model  ")).toBe("My_Model");
    });

    test("parseCustomCardDefault rejects empty values", () => {
      expect(parseCustomCardDefault("")).toBeNull();
      expect(parseCustomCardDefault('""')).toBeNull();
    });

    test("parseAnkiCustomCardDefaultFromFrontmatter reads key case-insensitively", () => {
      expect(
        parseAnkiCustomCardDefaultFromFrontmatter({
          anki_customCardDefault: "Vocab",
        }),
      ).toBe("Vocab");
      expect(
        parseAnkiCustomCardDefaultFromFrontmatter({
          ANKI_CUSTOMCARDDEFAULT: "My_Model",
        }),
      ).toBe("My_Model");
    });
  });

  describe("resolveFileDefaults", () => {
    test("returns none when frontmatter is null", () => {
      expect(resolveFileDefaults(null)).toEqual<FileDefaults>({
        builtIn: null,
        custom: null,
      });
    });

    test("returns none when keys are absent", () => {
      expect(resolveFileDefaults({ AnkiSync: "on" })).toEqual({
        builtIn: null,
        custom: null,
      });
    });

    test("returns builtIn only (FM-02)", () => {
      expect(resolveFileDefaults({ anki_cardDefault: "basic" })).toEqual({
        builtIn: "basic",
        custom: null,
      });
    });

    test("returns custom only (FM-03)", () => {
      expect(
        resolveFileDefaults({ anki_customCardDefault: "Vocab" }),
      ).toEqual({
        builtIn: null,
        custom: "Vocab",
      });
    });

    test("returns both when both keys are set — not a file-level conflict (FM-03)", () => {
      expect(
        resolveFileDefaults({
          anki_cardDefault: "basic",
          anki_customCardDefault: "Vocab",
        }),
      ).toEqual({
        builtIn: "basic",
        custom: "Vocab",
      });
    });

    test("resolveFileDefaultsFromRaw wraps parseFrontmatter", () => {
      const raw = `---
AnkiSync: on
anki_cardDefault: cloze
anki_customCardDefault: Vocab
---

# Note`;
      expect(resolveFileDefaultsFromRaw(raw)).toEqual({
        builtIn: "cloze",
        custom: "Vocab",
      });
      expect(resolveFileDefaultsFromRaw("# no frontmatter")).toEqual({
        builtIn: null,
        custom: null,
      });
      expect(resolveFileDefaultsFromRaw(raw)).toEqual(
        resolveFileDefaults(parseFrontmatter(raw)),
      );
    });
  });

  describe("FM-04 — ancestor headings override file defaults", () => {
    test("effectiveBuiltInDefaultFm04 prefers ancestor over file default", () => {
      expect(effectiveBuiltInDefaultFm04("cloze", { builtIn: "basic", custom: null })).toBe(
        "cloze",
      );
    });

    test("effectiveBuiltInDefaultFm04 falls back to file default when ancestor unset", () => {
      expect(
        effectiveBuiltInDefaultFm04(null, { builtIn: "basic", custom: null }),
      ).toBe("basic");
      expect(effectiveBuiltInDefaultFm04(null, { builtIn: null, custom: null })).toBeNull();
    });

    test("effectiveCustomNoteTypeFm04 prefers ancestor note type over file custom default", () => {
      expect(
        effectiveCustomNoteTypeFm04("Other", true, {
          builtIn: "basic",
          custom: "Vocab",
        }),
      ).toBe("Other");
    });

    test("effectiveCustomNoteTypeFm04 uses file custom default only with field blocks (RES-04)", () => {
      const defaults: FileDefaults = { builtIn: "basic", custom: "Vocab" };

      expect(effectiveCustomNoteTypeFm04(null, true, defaults)).toBe("Vocab");
      expect(effectiveCustomNoteTypeFm04(null, false, defaults)).toBeNull();
    });

    test("customDefaultAppliesRes04 requires layout and no inherited note type", () => {
      const defaults: FileDefaults = { builtIn: null, custom: "Vocab" };

      expect(customDefaultAppliesRes04(true, false, defaults)).toBe("Vocab");
      expect(customDefaultAppliesRes04(false, false, defaults)).toBeNull();
      expect(customDefaultAppliesRes04(true, true, defaults)).toBeNull();
      expect(
        customDefaultAppliesRes04(true, false, { builtIn: null, custom: null }),
      ).toBeNull();
    });
  });
});
