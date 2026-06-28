import { describe, expect, test } from "bun:test";
import {
  parseFrontmatter,
  parseBooleanFrontmatterValue,
  shouldSync,
  shouldSyncFile,
  getCardDeclarationHeadingLevel,
  getDelimiter,
  getIncludeParentHeadersAsTags,
  getTargetAnkiDeck,
  getFileAnkiTags,
} from "../../src/io/frontmatterFilter";

describe("frontmatterFilter", () => {
  test.each([
    ["on", true],
    ["true", true],
    ["yes", true],
    ["ON", true],
    ["off", false],
    ["false", false],
    ["no", false],
    ["maybe", null],
    ["", null],
  ] as const)("parseBooleanFrontmatterValue(%s)", (value, expected) => {
    expect(parseBooleanFrontmatterValue(value)).toBe(expected);
  });

  test("shouldSync returns true when AnkiSync is on", () => {
    expect(shouldSync({ AnkiSync: "on" })).toBe(true);
  });

  test("shouldSync returns true for true and yes", () => {
    expect(shouldSync({ AnkiSync: "true" })).toBe(true);
    expect(shouldSync({ ankisync: "yes" })).toBe(true);
  });

  test("shouldSync returns false when AnkiSync is off", () => {
    expect(shouldSync({ AnkiSync: "off" })).toBe(false);
  });

  test("shouldSync returns false when AnkiSync key is absent", () => {
    expect(shouldSync({ cardDeclarationHeadingLevel: "4" })).toBe(false);
  });

  test("shouldSync returns false for invalid AnkiSync value", () => {
    expect(shouldSync({ AnkiSync: "maybe" })).toBe(false);
  });

  test("parseFrontmatter extracts key-value pairs from YAML fence", () => {
    const raw = `---
AnkiSync: on
---

# Content
`;
    expect(parseFrontmatter(raw)).toEqual({
      AnkiSync: "on",
    });
  });

  test("parseFrontmatter returns null when no frontmatter fence", () => {
    expect(parseFrontmatter("# No frontmatter\n")).toBeNull();
  });

  test("shouldSyncFile returns false for missing frontmatter", () => {
    expect(shouldSyncFile("### Card\n\nFront? Back")).toBe(false);
  });

  test("shouldSyncFile returns true for valid sync-eligible file", () => {
    const raw = `---
AnkiSync: on
---

### Topic
Front ::: Back`;
    expect(shouldSyncFile(raw)).toBe(true);
  });

  test("shouldSyncFile returns false when AnkiSync is off", () => {
    const raw = `---
AnkiSync: off
---

#### Card
Front

:::

Back`;
    expect(shouldSyncFile(raw)).toBe(false);
  });

  test("shouldSyncFile returns false for ignore fixture content", async () => {
    const raw = await Bun.file(
      `${import.meta.dir}/../fixtures/ignore-invalid-no-sync-trigger.md`,
    ).text();
    expect(shouldSyncFile(raw)).toBe(false);
  });

  test("getCardDeclarationHeadingLevel reads YAML override", () => {
    const raw = `---
AnkiSync: on
cardDeclarationHeadingLevel: 3
---

# Note`;
    expect(getCardDeclarationHeadingLevel(raw, 4)).toBe(3);
  });

  test("getCardDeclarationHeadingLevel falls back for invalid values", () => {
    const raw = `---
cardDeclarationHeadingLevel: 9
---`;
    expect(getCardDeclarationHeadingLevel(raw, 4)).toBe(4);
  });

  test("getDelimiter reads YAML override", () => {
    const raw = `---
AnkiSync: on
delimiter: "?"
---

# Note`;
    expect(getDelimiter(raw, ":::")).toBe("?");
  });

  test("getDelimiter falls back when frontmatter omits delimiter", () => {
    const raw = `---
AnkiSync: on
---

# Note`;
    expect(getDelimiter(raw, ":::")).toBe(":::");
  });

  test("getDelimiter ignores empty frontmatter delimiter", () => {
    const raw = `---
delimiter:
---

# Note`;
    expect(getDelimiter(raw, ":::")).toBe(":::");
  });

  test("getIncludeParentHeadersAsTags reads YAML override", () => {
    const raw = `---
AnkiSync: on
includeParentHeadersAsTags: false
---

# Note`;
    expect(getIncludeParentHeadersAsTags(raw, true)).toBe(false);
  });

  test("getIncludeParentHeadersAsTags falls back when frontmatter omits key", () => {
    const raw = `---
AnkiSync: on
---

# Note`;
    expect(getIncludeParentHeadersAsTags(raw, true)).toBe(true);
    expect(getIncludeParentHeadersAsTags(raw, false)).toBe(false);
  });

  test("getIncludeParentHeadersAsTags falls back for invalid values", () => {
    const raw = `---
includeParentHeadersAsTags: maybe
---

# Note`;
    expect(getIncludeParentHeadersAsTags(raw, true)).toBe(true);
  });

  test("getTargetAnkiDeck reads YAML override", () => {
    const raw = `---
AnkiSync: on
target_anki_deck: "My Custom Deck"
---

# Note`;
    expect(getTargetAnkiDeck(raw, "Synced from Obsidian")).toBe("My Custom Deck");
  });

  test("getTargetAnkiDeck falls back when frontmatter omits key", () => {
    const raw = `---
AnkiSync: on
---

# Note`;
    expect(getTargetAnkiDeck(raw, "Synced from Obsidian")).toBe("Synced from Obsidian");
  });

  test("getFileAnkiTags parses comma-separated tags", () => {
    const raw = `---
AnkiSync: on
file_anki_tags: exam-prep, biology
---

# Note`;
    expect(getFileAnkiTags(raw)).toEqual(["exam-prep", "biology"]);
  });

  test("getFileAnkiTags normalizes tags with spaces", () => {
    const raw = `---
file_anki_tags: exam prep, biology review
---

# Note`;
    expect(getFileAnkiTags(raw)).toEqual(["exam_prep", "biology_review"]);
  });

  test("getFileAnkiTags returns empty array when frontmatter omits key", () => {
    const raw = `---
AnkiSync: on
---

# Note`;
    expect(getFileAnkiTags(raw)).toEqual([]);
  });
});
