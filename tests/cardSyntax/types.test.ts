import { describe, expect, test } from "bun:test";
import {
  BUILT_IN_CARD_TYPES,
  builtinCardType,
  createEmptyCardRegions,
  createSourceRange,
  customCardType,
  DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
  formatResolvedCardType,
  formatResolvedFrom,
  isBuiltInCardType,
  isCustomCardType,
  isEngineHashtag,
  mergeSyncOutcomes,
  type CardMessage,
  type CardRegions,
  type ParseCardDocumentResult,
  type ResolvedCard,
  type ResolvedCardType,
} from "../../src/cardSyntax/types";

describe("BuiltInCardType", () => {
  test("lists all v1 built-in card types from spec Section 0", () => {
    expect([...BUILT_IN_CARD_TYPES]).toEqual([
      "basic",
      "cloze",
      "reversible",
      "typed",
    ]);
  });

  test("isBuiltInCardType accepts spec values and rejects unknown ids", () => {
    expect(isBuiltInCardType("basic")).toBe(true);
    expect(isBuiltInCardType("cloze")).toBe(true);
    expect(isBuiltInCardType("reversible")).toBe(true);
    expect(isBuiltInCardType("typed")).toBe(true);
    expect(isBuiltInCardType("Vocab")).toBe(false);
    expect(isBuiltInCardType("noteType")).toBe(false);
  });
});

describe("ResolvedCardType", () => {
  test("builtinCardType wraps built-in ids", () => {
    const type: ResolvedCardType = builtinCardType("cloze");
    expect(type).toEqual({ kind: "builtin", type: "cloze" });
    expect(isCustomCardType(type)).toBe(false);
  });

  test("customCardType carries model id for CUS-01 custom models", () => {
    const type: ResolvedCardType = customCardType("Vocab");
    expect(type).toEqual({ kind: "custom", modelId: "Vocab" });
    expect(isCustomCardType(type)).toBe(true);
    expect(isBuiltInCardType(type.kind)).toBe(false);
  });

  test("formatResolvedCardType renders builtin and custom labels", () => {
    expect(formatResolvedCardType(builtinCardType("basic"))).toBe("basic");
    expect(formatResolvedCardType(customCardType("Vocab"))).toBe(
      "custom:Vocab",
    );
  });
});

describe("SourceRange and CardRegions", () => {
  test("createSourceRange supports byte offsets with optional line/column", () => {
    const range = createSourceRange(120, 240, {
      startLine: 10,
      endLine: 12,
      startColumn: 0,
      endColumn: 18,
    });

    expect(range).toEqual({
      start: 120,
      end: 240,
      startLine: 10,
      endLine: 12,
      startColumn: 0,
      endColumn: 18,
    });
  });

  test("CardRegions holds text, back, custom fields, and structural delimiters", () => {
    const text = createSourceRange(50, 100);
    const back = createSourceRange(110, 200);
    const regions: CardRegions = {
      text,
      back,
      fields: [{ name: "Word", range: createSourceRange(60, 80) }],
      delimiters: [
        { kind: ":::", range: createSourceRange(105, 108) },
        {
          kind: "field",
          fieldName: "Word",
          range: createSourceRange(55, 65),
        },
      ],
    };

    expect(regions.fields).toHaveLength(1);
    expect(regions.delimiters[0]?.kind).toBe(":::");
    expect(regions.delimiters[1]?.fieldName).toBe("Word");
  });

  test("createEmptyCardRegions starts with no text/back and empty delimiter list", () => {
    expect(createEmptyCardRegions()).toEqual({
      delimiters: [],
    });
  });
});

describe("SyncOutcome", () => {
  test("mergeSyncOutcomes prefers error over skip over warn over sync", () => {
    expect(mergeSyncOutcomes("sync", "warn")).toBe("warn");
    expect(mergeSyncOutcomes("warn", "sync")).toBe("warn");
    expect(mergeSyncOutcomes("skip", "warn")).toBe("skip");
    expect(mergeSyncOutcomes("error", "sync")).toBe("error");
    expect(mergeSyncOutcomes("sync", "sync")).toBe("sync");
  });
});

describe("engine hashtag namespace", () => {
  test("isEngineHashtag matches reserved #anki/ and #anki_card_ prefixes", () => {
    expect(isEngineHashtag("#anki/cardType/basic")).toBe(true);
    expect(isEngineHashtag("#anki/model/Vocab")).toBe(true);
    expect(isEngineHashtag("#anki_card_Vocab")).toBe(true);
    expect(isEngineHashtag("#exam-prep")).toBe(false);
    expect(isEngineHashtag("#biology")).toBe(false);
  });
});

describe("ResolvedCard fixture shapes", () => {
  test("models A1 basic sync card from stress-test fixture", () => {
    const card: ResolvedCard = {
      title: "A1 Basic OK",
      ordinal: 0,
      range: createSourceRange(1000, 1500, { startLine: 87, endLine: 94 }),
      resolvedType: builtinCardType("basic"),
      resolvedFrom: "anki_cardDefault",
      outcome: "sync",
      messages: [],
      regions: {
        text: createSourceRange(1050, 1120),
        back: createSourceRange(1130, 1200),
        delimiters: [{ kind: ":::", range: createSourceRange(1125, 1128) }],
      },
      hashtags: {
        user: ["exam-prep"],
        engine: [],
      },
      ankiTagPath: "Card Syntax Stress Test::Subsection A0::A1 Basic OK",
    };

    expect(card.outcome).toBe("sync");
    expect(formatResolvedFrom(card.resolvedFrom)).toBe("anki_cardDefault");
    expect(card.hashtags.user).toContain("exam-prep");
    expect(card.hashtags.engine).toHaveLength(0);
  });

  test("models A3 sync with warn messages (BAS-03, CX-07)", () => {
    const warnMessage: CardMessage = {
      level: "warn",
      text: 'Card "A3 Basic WARN bare {{}}": {{word}} treated as literal on basic card — warning',
      ruleId: "BAS-03",
    };

    const card: ResolvedCard = {
      title: "A3 Basic WARN bare {{}}",
      ordinal: 2,
      range: createSourceRange(2000, 2500),
      resolvedType: builtinCardType("basic"),
      resolvedFrom: "anki_cardDefault",
      outcome: "sync",
      messages: [warnMessage],
      regions: createEmptyCardRegions(),
      hashtags: { user: [], engine: [] },
    };

    expect(card.outcome).toBe("sync");
    expect(card.messages[0]?.level).toBe("warn");
    expect(card.messages[0]?.ruleId).toBe("BAS-03");
  });

  test("models F1 basic + :::r conflict as error outcome", () => {
    const card: ResolvedCard = {
      title: "F1 basic + :::r",
      ordinal: 0,
      range: createSourceRange(5000, 5500),
      resolvedType: builtinCardType("basic"),
      resolvedFrom: "card heading",
      outcome: "error",
      messages: [
        {
          level: "error",
          text: 'Card "F1 basic + :::r": :::r conflicts with resolved type "basic" — error',
          ruleId: "CX-09",
        },
      ],
      regions: {
        delimiters: [{ kind: ":::r", range: createSourceRange(5100, 5104) }],
      },
      hashtags: {
        user: [],
        engine: ["#anki/cardType/basic"],
      },
    };

    expect(card.outcome).toBe("error");
    expect(card.regions.delimiters[0]?.kind).toBe(":::r");
  });
});

describe("ParseCardDocumentOptions and ParseCardDocumentResult", () => {
  test("DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS matches spec and stress-test frontmatter", () => {
    expect(DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS).toEqual({
      inferClozeFromManualSyntaxOnBasic: false,
      cardDeclarationHeadingLevel: 4,
      delimiter: ":::",
      includeParentHeadersAsTags: true,
      bodyStartOffset: 0,
    });
  });

  test("ParseCardDocumentResult bundles sync gate, defaults, cards, and messages", () => {
    const result: ParseCardDocumentResult = {
      syncEligible: true,
      fileDefaults: {
        builtInDefault: "basic",
        customModelDefault: "Vocab",
      },
      cards: [],
      messages: [],
    };

    expect(result.syncEligible).toBe(true);
    expect(result.fileDefaults.builtInDefault).toBe("basic");
    expect(result.fileDefaults.customModelDefault).toBe("Vocab");
  });
});
