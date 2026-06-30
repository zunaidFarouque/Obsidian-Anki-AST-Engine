import { describe, expect, test } from "bun:test";
import { getBodyStartOffset } from "../../src/io/frontmatterFilter";
import {
  DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
  formatResolvedCardType,
} from "../../src/cardSyntax/types";
import { parseCardDocument } from "../../src/cardSyntax/parseCardDocument";
import { loadCardSyntaxStressTest } from "../../src/cardSyntax/loadFixture";

const SYNC_HEADER = `---
AnkiSync: on
anki_cardDefault: basic
---

`;

function parseDoc(body: string, options?: Parameters<typeof parseCardDocument>[1]) {
  return parseCardDocument(SYNC_HEADER + body, {
    ...DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
    bodyStartOffset: getBodyStartOffset(SYNC_HEADER + body),
    ...options,
  });
}

describe("parseCardDocument — sync gate", () => {
  test("returns syncEligible false when AnkiSync is absent", () => {
    const result = parseCardDocument("# Notes\n\n#### Card\n\nQ\n\n:::\n\nA");

    expect(result.syncEligible).toBe(false);
    expect(result.cards).toHaveLength(0);
  });

  test("returns syncEligible true when AnkiSync is on", () => {
    const result = parseDoc("#### Card\n\nQ\n\n:::\n\nA");

    expect(result.syncEligible).toBe(true);
    expect(result.fileDefaults.builtInDefault).toBe("basic");
  });
});

describe("parseCardDocument — basic cards", () => {
  test("syncs a minimal basic card with ::: delimiter", () => {
    const result = parseDoc(
      "#### Speed of light\n\nWhat is c?\n\n:::\n\n$3 \\times 10^8$ m/s",
    );

    expect(result.cards).toHaveLength(1);
    const card = result.cards[0]!;
    expect(card.title).toBe("Speed of light");
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("basic");
    expect(card.regions.delimiters.some((d) => d.kind === ":::")).toBe(true);
  });

  test("skips basic card missing ::: delimiter", () => {
    const result = parseDoc("#### Incomplete\n\nFront only, no split.");

    expect(result.cards).toHaveLength(1);
    const card = result.cards[0]!;
    expect(card.outcome).toBe("skip");
    expect(card.messages.some((m) => m.ruleId === "BAS-01")).toBe(true);
  });
});

describe("parseCardDocument — cloze cards", () => {
  test("syncs inherited cloze from section heading", () => {
    const result = parseDoc(
      "### Week 2 #anki/cardType/cloze\n\n#### Mitochondria\n\nThe {{mitochondria}} is the powerhouse.",
    );

    expect(result.cards).toHaveLength(1);
    const card = result.cards[0]!;
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("cloze");
    expect(card.resolvedFrom).toContain("inherited");
  });

  test("skips cloze card with no deletions in Text region", () => {
    const result = parseDoc(
      "### Section #anki/cardType/cloze\n\n#### Empty cloze\n\nNo braces here.",
    );

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]!.outcome).toBe("skip");
    expect(result.cards[0]!.messages.some((m) => m.ruleId === "CLZ-01")).toBe(
      true,
    );
  });
});

describe("parseCardDocument — reversible delimiter", () => {
  test("syncs card with :::r delimiter", () => {
    const raw = `---
AnkiSync: on
---

#### Reversible

Question

:::r

Answer`;
    const result = parseCardDocument(raw, {
      ...DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
      bodyStartOffset: getBodyStartOffset(raw),
    });

    expect(result.cards).toHaveLength(1);
    const card = result.cards[0]!;
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("reversible");
  });
});

describe("parseCardDocument — hashtag conflicts", () => {
  test("errors when card heading has conflicting type tags", () => {
    const result = parseDoc(
      "#### Bad #anki/cardType/basic #anki/cardType/cloze\n\nQ\n\n:::\n\nA",
    );

    expect(result.cards).toHaveLength(1);
    const card = result.cards[0]!;
    expect(card.outcome).toBe("error");
    expect(card.messages.some((m) => m.ruleId === "TAG-01")).toBe(true);
  });

  test("errors when section heading has dual cardType tags (TAG-01, CX-26)", () => {
    const result = parseDoc(
      "### Bad #anki/cardType/cloze #anki/cardType/basic\n\n#### Child\n\nQ\n\n:::\n\nA",
    );

    const card = result.cards[0]!;
    expect(card.outcome).toBe("error");
    expect(card.messages.some((m) => m.ruleId === "TAG-01")).toBe(true);
    expect(card.messages.some((m) => m.ruleId === "CX-01")).toBe(true);
    expect(card.messages.some((m) => m.ruleId === "CX-26")).toBe(true);
  });

  test("errors when section heading mixes cardType and model (TAG-02, CX-02)", () => {
    const result = parseDoc(
      "### Bad #anki/cardType/cloze #anki/noteType/Vocab\n\n#### Child\n\n::: Word\nw\n\n::: Definition\nd",
    );

    const card = result.cards[0]!;
    expect(card.outcome).toBe("error");
    expect(card.messages.some((m) => m.ruleId === "TAG-02")).toBe(true);
    expect(card.messages.some((m) => m.ruleId === "CX-02")).toBe(true);
  });
});

describe("parseCardDocument — CX-27a inferClozeFromManualSyntaxOnBasic", () => {
  test("reclassifies basic-resolved card with {{cN::}} as cloze when option is true", () => {
    const raw = `---
AnkiSync: on
anki_cardDefault: basic
---

#### Card
The {{c1::mitochondria}} is important.
`;

    const result = parseCardDocument(raw, {
      ...DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
      inferClozeFromManualSyntaxOnBasic: true,
      bodyStartOffset: getBodyStartOffset(raw),
    });

    const card = result.cards[0]!;
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("cloze");
    expect(card.messages.some((m) => m.ruleId === "BAS-04")).toBe(false);
  });
});

describe("parseCardDocument — loadFixture helper", () => {
  test("loads stress-test markdown fixture", async () => {
    const raw = await loadCardSyntaxStressTest();

    expect(raw).toContain("AnkiSync: on");
    expect(raw).toContain("#### A1 Basic OK");
  });
});
