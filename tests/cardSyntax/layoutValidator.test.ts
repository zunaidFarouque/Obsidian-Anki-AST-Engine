import { describe, expect, test } from "bun:test";
import {
  extractTypedBackPlainText,
  validateCardLayout,
  type CardLayoutRegions,
  type LayoutValidatorOptions,
  type ResolvedCardType,
} from "../../src/cardSyntax/layoutValidator";

function regions(
  overrides: Partial<CardLayoutRegions> = {},
): CardLayoutRegions {
  return {
    cardTitle: "Card",
    textRegion: "",
    hasPlainSplit: false,
    hasReversibleDelimiter: false,
    hasTypedDelimiter: false,
    fieldBlocks: [],
    ...overrides,
  };
}

function options(
  overrides: Partial<LayoutValidatorOptions> = {},
): LayoutValidatorOptions {
  return {
    cardTitle: "Card",
    ...overrides,
  };
}

const basic: ResolvedCardType = { kind: "builtin", type: "basic" };
const cloze: ResolvedCardType = { kind: "builtin", type: "cloze" };
const reversible: ResolvedCardType = { kind: "builtin", type: "reversible" };
const typed: ResolvedCardType = { kind: "builtin", type: "typed" };
const customVocab: ResolvedCardType = {
  kind: "custom",
  noteTypeId: "Vocab",
  fieldNames: ["Word", "Definition", "Example"],
};

function messageText(result: ReturnType<typeof validateCardLayout>): string {
  return result.messages.map((m) => m.message).join("\n");
}

describe("validateCardLayout — BAS-01 basic requires :::", () => {
  test("skips basic card without plain ::: split", () => {
    const result = validateCardLayout(
      basic,
      regions({ textRegion: "Only front prose." }),
      options({ cardTitle: "Incomplete" }),
    );

    expect(result.outcome).toBe("skip");
    expect(result.messages.some((m) => m.ruleId === "BAS-01")).toBe(true);
    expect(messageText(result)).toContain(
      'Card "Incomplete": basic card missing ::: delimiter — skipped',
    );
  });

  test("syncs basic card with plain ::: split", () => {
    const result = validateCardLayout(
      basic,
      regions({
        textRegion: "Question?",
        backRegion: "Answer.",
        hasPlainSplit: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("sync");
  });
});

describe("validateCardLayout — BAS-03 bare {{word}} on basic", () => {
  test("warns and syncs when bare {{}} appears on basic", () => {
    const result = validateCardLayout(
      basic,
      regions({
        textRegion: "Uses {{username}} for logging.",
        backRegion: "See docs.",
        hasPlainSplit: true,
      }),
      options({ cardTitle: "CS note" }),
    );

    expect(result.outcome).toBe("sync");
    expect(result.messages.some((m) => m.ruleId === "BAS-03" && m.kind === "warn")).toBe(
      true,
    );
    expect(messageText(result)).toContain("{{username}}");
    expect(messageText(result)).toContain("literal on basic card");
  });
});

describe("validateCardLayout — BAS-04 manual cloze on basic-resolved", () => {
  test("warns and stays basic by default", () => {
    const result = validateCardLayout(
      basic,
      regions({
        textRegion: "The {{c1::mitochondria}} is important.",
        backRegion: "Organelle details.",
        hasPlainSplit: true,
      }),
      options({ cardTitle: "Card" }),
    );

    expect(result.outcome).toBe("sync");
    expect(result.messages.some((m) => m.ruleId === "BAS-04" && m.kind === "warn")).toBe(
      true,
    );
    expect(result.effectiveType).toEqual(basic);
  });

  test("reclassifies as cloze when inferClozeFromManualSyntaxOnBasic is true", () => {
    const result = validateCardLayout(
      basic,
      regions({
        textRegion: "The {{c1::mitochondria}} is important.",
        backRegion: "Organelle details.",
        hasPlainSplit: true,
      }),
      options({ inferClozeFromManualSyntaxOnBasic: true }),
    );

    expect(result.outcome).toBe("sync");
    expect(result.messages.some((m) => m.ruleId === "BAS-04")).toBe(false);
    expect(result.effectiveType).toEqual(cloze);
  });
});

describe("validateCardLayout — BAS-05 cloze syntax only in Back", () => {
  test("syncs basic when {{cN::}} appears only after :::", () => {
    const result = validateCardLayout(
      basic,
      regions({
        textRegion: "Normal front question",
        backRegion: "The {{c1::answer}} was hidden here.",
        hasPlainSplit: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("sync");
    expect(result.messages.some((m) => m.ruleId === "BAS-04")).toBe(false);
  });
});

describe("validateCardLayout — BAS-06 wrong layout for basic", () => {
  test("errors on basic + :::r", () => {
    const result = validateCardLayout(
      basic,
      regions({
        textRegion: "Question",
        backRegion: "Answer",
        hasReversibleDelimiter: true,
      }),
      options({ cardTitle: "Card" }),
    );

    expect(result.outcome).toBe("error");
    expect(result.messages.some((m) => m.ruleId === "BAS-06" || m.ruleId === "REV-04")).toBe(
      true,
    );
    expect(messageText(result)).toContain(':::r conflicts with resolved type "basic"');
  });

  test("errors on basic + :::t", () => {
    const result = validateCardLayout(
      basic,
      regions({
        textRegion: "Question",
        backRegion: "Answer",
        hasTypedDelimiter: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("error");
    expect(messageText(result)).toContain(':::t conflicts with resolved type "basic"');
  });

  test("errors on basic + ::: Field when custom note type default is available", () => {
    const result = validateCardLayout(
      basic,
      regions({
        textRegion: "",
        fieldBlocks: [{ fieldName: "Word", content: "entropy" }],
      }),
      options({ customNoteTypeDefaultAvailable: true }),
    );

    expect(result.outcome).toBe("error");
    expect(result.messages.some((m) => m.ruleId === "BAS-06")).toBe(true);
  });
});

describe("validateCardLayout — CLZ-01 cloze requires Text region deletions", () => {
  test("skips cloze with no deletions in Text region", () => {
    const result = validateCardLayout(
      cloze,
      regions({ textRegion: "No deletions here, only prose." }),
      options({ cardTitle: "Card" }),
    );

    expect(result.outcome).toBe("skip");
    expect(result.messages.some((m) => m.ruleId === "CLZ-01")).toBe(true);
    expect(messageText(result)).toContain(
      "cloze card has no {{}} deletions in Text region",
    );
  });

  test("syncs cloze with valid Text region deletion", () => {
    const result = validateCardLayout(
      cloze,
      regions({ textRegion: "The {{c1::mitochondria}} produces ATP." }),
      options(),
    );

    expect(result.outcome).toBe("sync");
  });

  test("syncs cloze with shorthand deletion in Text region", () => {
    const result = validateCardLayout(
      cloze,
      regions({ textRegion: "The {{mitochondria}} produces ATP." }),
      options(),
    );

    expect(result.outcome).toBe("sync");
  });
});

describe("validateCardLayout — CLZ-10/11 cloze delimiter and Back-only deletions", () => {
  test("errors on cloze + :::r", () => {
    const result = validateCardLayout(
      cloze,
      regions({
        textRegion: "The {{c1::mitochondria}} produces ATP.",
        backRegion: "Extra",
        hasReversibleDelimiter: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("error");
    expect(result.messages.some((m) => m.ruleId === "CLZ-10")).toBe(true);
    expect(messageText(result)).toContain(':::r conflicts with resolved type "cloze"');
  });

  test("errors on cloze + :::t", () => {
    const result = validateCardLayout(
      cloze,
      regions({
        textRegion: "The {{c1::mitochondria}} produces ATP.",
        hasTypedDelimiter: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("error");
    expect(messageText(result)).toContain(':::t conflicts with resolved type "cloze"');
  });

  test("errors when deletions exist only after ::: (CLZ-11)", () => {
    const result = validateCardLayout(
      cloze,
      regions({
        textRegion: "Prose with no deletions.",
        backRegion: "{{c1::too late}}",
        hasPlainSplit: true,
      }),
      options({ cardTitle: "Card" }),
    );

    expect(result.outcome).toBe("error");
    expect(result.messages.some((m) => m.ruleId === "CLZ-11")).toBe(true);
    expect(messageText(result)).toContain("cloze deletions only in Back region");
    expect(messageText(result)).toContain("— error");
  });
});

describe("validateCardLayout — REV-03..05 reversible", () => {
  test("skips reversible without split", () => {
    const result = validateCardLayout(
      reversible,
      regions({ textRegion: "Question only." }),
      options(),
    );

    expect(result.outcome).toBe("skip");
    expect(result.messages.some((m) => m.ruleId === "REV-03")).toBe(true);
  });

  test("syncs reversible with ::: split", () => {
    const result = validateCardLayout(
      reversible,
      regions({
        textRegion: "Question",
        backRegion: "Answer",
        hasPlainSplit: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("sync");
  });

  test("syncs reversible with :::r split", () => {
    const result = validateCardLayout(
      reversible,
      regions({
        textRegion: "Question",
        backRegion: "Answer",
        hasReversibleDelimiter: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("sync");
  });

  test("errors on cloze + :::r (REV-05)", () => {
    const result = validateCardLayout(
      cloze,
      regions({
        textRegion: "{{c1::term}}",
        hasReversibleDelimiter: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("error");
    expect(result.messages.some((m) => m.ruleId === "REV-05" || m.ruleId === "CLZ-10")).toBe(
      true,
    );
  });

  test("errors REV-06 when reversible conflicts with :::t", () => {
    const result = validateCardLayout(
      reversible,
      regions({
        textRegion: "Question",
        backRegion: "Answer",
        hasTypedDelimiter: true,
      }),
      options({ cardTitle: "Mismatch" }),
    );

    expect(result.outcome).toBe("error");
    expect(result.messages.some((m) => m.ruleId === "REV-06")).toBe(true);
    expect(messageText(result)).toContain(':::t conflicts with resolved type "reversible"');
  });

  test("errors REV-06 when both :::r and :::t are present", () => {
    const result = validateCardLayout(
      reversible,
      regions({
        textRegion: "Question",
        backRegion: "Answer",
        hasReversibleDelimiter: true,
        hasEmbeddedTypedDelimiter: true,
      }),
      options({ cardTitle: "Both" }),
    );

    expect(result.outcome).toBe("error");
    expect(result.messages.some((m) => m.ruleId === "REV-06")).toBe(true);
  });
});

describe("validateCardLayout — TYP-02..04 typed", () => {
  test("errors REV-06 when typed conflicts with :::r", () => {
    const result = validateCardLayout(
      typed,
      regions({
        textRegion: "Capital?",
        backRegion: "Paris",
        hasReversibleDelimiter: true,
      }),
      options({ cardTitle: "Mismatch" }),
    );

    expect(result.outcome).toBe("error");
    expect(result.messages.some((m) => m.ruleId === "REV-06")).toBe(true);
    expect(messageText(result)).toContain(':::r conflicts with resolved type "typed"');
  });

  test("skips typed without split", () => {
    const result = validateCardLayout(
      typed,
      regions({ textRegion: "Capital of France?" }),
      options(),
    );

    expect(result.outcome).toBe("skip");
    expect(result.messages.some((m) => m.ruleId === "TYP-02")).toBe(true);
  });

  test("syncs typed with :::t and extracts plain back (TYP-03)", () => {
    const result = validateCardLayout(
      typed,
      regions({
        textRegion: "Capital of France?",
        backRegion: "**Paris**",
        hasTypedDelimiter: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("sync");
    expect(result.typedBackPlainText).toBe("Paris");
  });

  test("uses first non-empty line of typed back (TYP-04)", () => {
    const result = validateCardLayout(
      typed,
      regions({
        textRegion: "Capital of France?",
        backRegion: "\nParis\nLyon\n",
        hasTypedDelimiter: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("sync");
    expect(result.typedBackPlainText).toBe("Paris");
  });
});

describe("extractTypedBackPlainText — TYP-03/04", () => {
  test("strips HTML and returns first non-empty line", () => {
    expect(extractTypedBackPlainText("**Paris**\nLyon")).toBe("Paris");
    expect(extractTypedBackPlainText("\n  Paris  \nLyon")).toBe("Paris");
    expect(extractTypedBackPlainText("&amp;")).toBe("&");
  });
});

describe("extractTypedBackPlainText — TYP-05 multi-answer", () => {
  test("splits pipe-separated alternatives and trims spaces around |", () => {
    expect(extractTypedBackPlainText("Paris | Lyon | Marseille")).toBe(
      "Paris|Lyon|Marseille",
    );
    expect(extractTypedBackPlainText("Paris|Lyon|Marseille")).toBe(
      "Paris|Lyon|Marseille",
    );
    expect(extractTypedBackPlainText("Answer one | Answer two")).toBe(
      "Answer one|Answer two",
    );
  });

  test("drops empty pipe segments and ignores later lines (TYP-04 then TYP-05)", () => {
    expect(extractTypedBackPlainText("Paris||Lyon")).toBe("Paris|Lyon");
    expect(extractTypedBackPlainText("Paris | | Lyon\nMarseille")).toBe(
      "Paris|Lyon",
    );
  });

  test("strips formatting before splitting (TYP-03 then TYP-05)", () => {
    expect(extractTypedBackPlainText("**Paris** | <em>Lyon</em>")).toBe(
      "Paris|Lyon",
    );
  });
});

describe("validateCardLayout — CUS-01..05 custom", () => {
  test("skips custom without field blocks", () => {
    const result = validateCardLayout(
      customVocab,
      regions({ textRegion: "plain prose only" }),
      options(),
    );

    expect(result.outcome).toBe("skip");
    expect(result.messages.some((m) => m.ruleId === "CUS-01")).toBe(true);
  });

  test("syncs custom with matching field blocks", () => {
    const result = validateCardLayout(
      customVocab,
      regions({
        fieldBlocks: [
          { fieldName: "Word", content: "entropy" },
          { fieldName: "Definition", content: "Energy dispersal." },
        ],
      }),
      options(),
    );

    expect(result.outcome).toBe("sync");
  });

  test("errors on unknown custom field (CUS-02)", () => {
    const result = validateCardLayout(
      customVocab,
      regions({
        fieldBlocks: [{ fieldName: "Definiton", content: "typo field" }],
      }),
      options({ cardTitle: "Term" }),
    );

    expect(result.outcome).toBe("error");
    expect(result.messages.some((m) => m.ruleId === "CUS-02")).toBe(true);
    expect(messageText(result)).toContain('unknown field "Definiton"');
    expect(messageText(result)).toContain("Word, Definition, Example");
  });

  test("skips orphan custom layout without resolved note type (CUS-03)", () => {
    const result = validateCardLayout(
      basic,
      regions({
        fieldBlocks: [{ fieldName: "Word", content: "entropy" }],
      }),
      options({ cardTitle: "Term" }),
    );

    expect(result.outcome).toBe("skip");
    expect(result.messages.some((m) => m.ruleId === "CUS-03")).toBe(true);
    expect(messageText(result)).toContain("custom field layout but no note type resolved");
  });

  test("skips custom with only plain ::: (CUS-04)", () => {
    const result = validateCardLayout(
      customVocab,
      regions({
        textRegion: "front",
        backRegion: "back",
        hasPlainSplit: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("skip");
    expect(result.messages.some((m) => m.ruleId === "CUS-04")).toBe(true);
  });

  test("errors on custom + :::r (CUS-05)", () => {
    const result = validateCardLayout(
      customVocab,
      regions({
        fieldBlocks: [{ fieldName: "Word", content: "entropy" }],
        hasReversibleDelimiter: true,
      }),
      options(),
    );

    expect(result.outcome).toBe("error");
    expect(result.messages.some((m) => m.ruleId === "CUS-05")).toBe(true);
  });
});
