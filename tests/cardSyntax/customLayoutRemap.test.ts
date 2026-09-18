import { describe, expect, test } from "bun:test";
import { parseCardDocument } from "../../src/cardSyntax/parseCardDocument";
import { validateCardLayout } from "../../src/cardSyntax/layoutValidator";
import {
  resolveCustomLayoutMapping,
  type CustomLayoutMap,
} from "../../src/cardSyntax/types";
import {
  parseAnkiCustomLayoutMapFromFrontmatter,
  resolveFileDefaults,
} from "../../src/cardSyntax/frontmatterDefaults";

describe("CUS-07 Custom Field Layout Remapping", () => {
  describe("resolveCustomLayoutMapping helper", () => {
    test("resolves tuple [front, back] mapping", () => {
      const map: CustomLayoutMap = {
        Vocab: ["Word", "Definition"],
      };
      expect(resolveCustomLayoutMapping(map, "Vocab")).toEqual({
        front: "Word",
        back: "Definition",
      });
    });

    test("resolves object { front, back } mapping", () => {
      const map: CustomLayoutMap = {
        Vocab: { front: "Word", back: "Definition" },
      };
      expect(resolveCustomLayoutMapping(map, "Vocab")).toEqual({
        front: "Word",
        back: "Definition",
      });
    });

    test("resolves case-insensitively", () => {
      const map: CustomLayoutMap = {
        vocab: ["Word", "Definition"],
      };
      expect(resolveCustomLayoutMapping(map, "Vocab")).toEqual({
        front: "Word",
        back: "Definition",
      });
    });

    test("resolves wildcard * mapping when exact match absent", () => {
      const map: CustomLayoutMap = {
        "*": ["Front", "Back"],
      };
      expect(resolveCustomLayoutMapping(map, "CustomType")).toEqual({
        front: "Front",
        back: "Back",
      });
    });

    test("returns undefined for missing mapping or invalid mapping", () => {
      expect(resolveCustomLayoutMapping(undefined, "Vocab")).toBeUndefined();
      expect(resolveCustomLayoutMapping({}, "Vocab")).toBeUndefined();
      expect(
        resolveCustomLayoutMapping({ Vocab: ["", "Definition"] } as any, "Vocab"),
      ).toBeUndefined();
    });
  });

  describe("Frontmatter parsing for anki_customLayoutMap", () => {
    test("parses JSON string map", () => {
      const result = parseAnkiCustomLayoutMapFromFrontmatter({
        anki_customlayoutmap: '{"Vocab": ["Word", "Definition"]}',
      });
      expect(result).toEqual({
        Vocab: ["Word", "Definition"],
      });
    });

    test("parses JSON object with front/back", () => {
      const result = parseAnkiCustomLayoutMapFromFrontmatter({
        anki_customlayoutmap: '{"Vocab": {"front": "Word", "back": "Definition"}}',
      });
      expect(result).toEqual({
        Vocab: { front: "Word", back: "Definition" },
      });
    });

    test("parses array format with custom card default", () => {
      const result = parseAnkiCustomLayoutMapFromFrontmatter(
        {
          anki_customlayoutmap: '["Word", "Definition"]',
        },
        "Vocab",
      );
      expect(result).toEqual({
        Vocab: ["Word", "Definition"],
      });
    });

    test("resolves via resolveFileDefaults", () => {
      const defaults = resolveFileDefaults({
        anki_customcarddefault: "Vocab",
        anki_customlayoutmap: '{"Vocab": ["Word", "Definition"]}',
      });
      expect(defaults.custom).toBe("Vocab");
      expect(defaults.customLayoutMap).toEqual({
        Vocab: ["Word", "Definition"],
      });
    });
  });

  describe("layoutValidator with customLayoutMap", () => {
    test("plain ::: with valid layout map avoids CUS-04 and outcomes sync", () => {
      const result = validateCardLayout(
        {
          kind: "custom",
          noteTypeId: "Vocab",
          fieldNames: ["Word", "Definition", "Example"],
        },
        {
          cardTitle: "Test Card",
          textRegion: "Apple",
          backRegion: "A fruit",
          hasPlainSplit: true,
          hasReversibleDelimiter: false,
          hasTypedDelimiter: false,
          fieldBlocks: [],
        },
        {
          customLayoutMap: {
            Vocab: ["Word", "Definition"],
          },
        },
      );

      expect(result.outcome).toBe("sync");
      expect(result.messages.some((m) => m.ruleId === "CUS-04")).toBe(false);
    });

    test("error case when mapped field does not exist in model (CUS-02)", () => {
      const result = validateCardLayout(
        {
          kind: "custom",
          noteTypeId: "Vocab",
          fieldNames: ["Word", "Definition"],
        },
        {
          cardTitle: "Test Card",
          textRegion: "Apple",
          backRegion: "A fruit",
          hasPlainSplit: true,
          hasReversibleDelimiter: false,
          hasTypedDelimiter: false,
          fieldBlocks: [],
        },
        {
          customLayoutMap: {
            Vocab: ["Word", "NonExistentField"],
          },
        },
      );

      expect(result.outcome).toBe("error");
      const err = result.messages.find((m) => m.ruleId === "CUS-02");
      expect(err).toBeDefined();
      expect(err?.message).toContain("unknown field \"NonExistentField\"");
    });

    test("without layout map, plain ::: on custom card still triggers CUS-04 skip", () => {
      const result = validateCardLayout(
        {
          kind: "custom",
          noteTypeId: "Vocab",
          fieldNames: ["Word", "Definition"],
        },
        {
          cardTitle: "Test Card",
          textRegion: "Apple",
          backRegion: "A fruit",
          hasPlainSplit: true,
          hasReversibleDelimiter: false,
          hasTypedDelimiter: false,
          fieldBlocks: [],
        },
        {},
      );

      expect(result.outcome).toBe("skip");
      expect(result.messages.some((m) => m.ruleId === "CUS-04")).toBe(true);
    });

    test("conflicting delimiters with custom layout remap (:::r still triggers CUS-05)", () => {
      const result = validateCardLayout(
        {
          kind: "custom",
          noteTypeId: "Vocab",
          fieldNames: ["Word", "Definition"],
        },
        {
          cardTitle: "Test Card",
          textRegion: "Apple",
          backRegion: "A fruit",
          hasPlainSplit: true,
          hasReversibleDelimiter: true,
          hasTypedDelimiter: false,
          fieldBlocks: [],
        },
        {
          customLayoutMap: {
            Vocab: ["Word", "Definition"],
          },
        },
      );

      expect(result.outcome).toBe("error");
      expect(result.messages.some((m) => m.ruleId === "CUS-05")).toBe(true);
    });
  });

  describe("parseCardDocument with custom field remapping", () => {
    test("plain ::: with explicit options.customLayoutMap synthesizes customFields", () => {
      const doc = `---
AnkiSync: on
---

#### Apple #anki/noteType/Vocab
Apple
:::
A round red fruit
`;
      const result = parseCardDocument(doc, {
        customLayoutMap: {
          Vocab: ["Word", "Definition"],
        },
        noteTypeFieldNamesByNoteType: {
          Vocab: ["Word", "Definition", "Example"],
        },
      });

      expect(result.cards).toHaveLength(1);
      const card = result.cards[0]!;
      expect(card.outcome).toBe("sync");
      expect(card.resolvedType).toEqual({
        kind: "custom",
        noteTypeId: "Vocab",
      });
      expect(card.customFields).toBeDefined();
      expect(card.customFields).toHaveLength(2);
      expect(card.customFields![0]!.name).toBe("Word");
      expect(card.customFields![1]!.name).toBe("Definition");
    });

    test("plain ::: with object { front, back } customLayoutMap synthesizes customFields", () => {
      const doc = `---
AnkiSync: on
---

#### Apple #anki/noteType/Vocab
Apple
:::
A round red fruit
`;
      const result = parseCardDocument(doc, {
        customLayoutMap: {
          Vocab: { front: "Word", back: "Definition" },
        },
        noteTypeFieldNamesByNoteType: {
          Vocab: ["Word", "Definition", "Example"],
        },
      });

      expect(result.cards).toHaveLength(1);
      const card = result.cards[0]!;
      expect(card.outcome).toBe("sync");
      expect(card.customFields).toHaveLength(2);
      expect(card.customFields![0]!.name).toBe("Word");
      expect(card.customFields![1]!.name).toBe("Definition");
    });

    test("plain ::: with frontmatter anki_customLayoutMap synthesizes customFields", () => {
      const doc = `---
AnkiSync: on
anki_customCardDefault: Vocab
anki_customLayoutMap: '{"Vocab": ["Word", "Definition"]}'
---

#### Apple
Apple
:::
A round fruit
`;
      const result = parseCardDocument(doc, {
        noteTypeFieldNamesByNoteType: {
          Vocab: ["Word", "Definition"],
        },
      });

      expect(result.cards).toHaveLength(1);
      const card = result.cards[0]!;
      expect(card.outcome).toBe("sync");
      expect(card.resolvedType).toEqual({
        kind: "custom",
        noteTypeId: "Vocab",
      });
      expect(card.customFields).toHaveLength(2);
      expect(card.customFields![0]!.name).toBe("Word");
      expect(card.customFields![1]!.name).toBe("Definition");
    });

    test("ancestor inheritance custom note type with options.customLayoutMap", () => {
      const doc = `---
AnkiSync: on
---

# Biology #anki/noteType/Vocab

#### Mitosis
Cell division process
:::
Results in two identical daughter cells
`;
      const result = parseCardDocument(doc, {
        customLayoutMap: {
          Vocab: ["Word", "Definition"],
        },
        noteTypeFieldNamesByNoteType: {
          Vocab: ["Word", "Definition"],
        },
      });

      expect(result.cards).toHaveLength(1);
      const card = result.cards[0]!;
      expect(card.outcome).toBe("sync");
      expect(card.resolvedType).toEqual({
        kind: "custom",
        noteTypeId: "Vocab",
      });
      expect(card.customFields).toHaveLength(2);
      expect(card.customFields![0]!.name).toBe("Word");
      expect(card.customFields![1]!.name).toBe("Definition");
    });
  });
});
