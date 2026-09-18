import { describe, expect, test } from "bun:test";
import { parseCardDocument } from "../../src/cardSyntax/parseCardDocument";
import { formatResolvedCardType } from "../../src/cardSyntax/types";

function parseSingleCard(
  doc: string,
  options?: Parameters<typeof parseCardDocument>[1],
) {
  const result = parseCardDocument(doc, options);
  expect(result.syncEligible).toBe(true);
  expect(result.cards.length).toBeGreaterThanOrEqual(1);
  return result.cards[0]!;
}

describe("Section 11 — Master Conflict Matrix (CX-01 through CX-32)", () => {
  // CX-01: #anki/cardType/cloze + #anki/cardType/basic on same heading -> error (TAG-01, CX-01)
  test("CX-01: conflicting cardType tags on same card heading -> error (TAG-01, CX-01)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-01 Card #anki/cardType/cloze #anki/cardType/basic

Question

:::

Answer
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("TAG-01");
    expect(ruleIds).toContain("CX-01");
  });

  // CX-02: #anki/cardType/cloze + #anki/noteType/Vocab on same heading -> error (TAG-02, CX-02)
  test("CX-02: conflicting cardType and noteType on same card heading -> error (TAG-02, CX-02)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-02 Card #anki/cardType/cloze #anki/noteType/Vocab

::: Word
mitochondria

::: Definition
powerhouse of the cell
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("TAG-02");
    expect(ruleIds).toContain("CX-02");
  });

  // CX-03: ### cloze + #### #anki/cardType/basic -> basic ::: -> sync (RES-01)
  test("CX-03: card heading basic override under cloze section -> sync basic (RES-01)", () => {
    const doc = `---
AnkiSync: on
---

### Section #anki/cardType/cloze

#### CX-03 Card #anki/cardType/basic

Front question

:::

Back answer
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("basic");
    expect(card.resolvedFrom).toContain("card heading #anki/cardType/basic");
  });

  // CX-04: ### cloze + #### no override -> cloze {{text}} -> sync (STR-02)
  test("CX-04: cloze inherited from section with valid deletion -> sync cloze (STR-02)", () => {
    const doc = `---
AnkiSync: on
---

### Section #anki/cardType/cloze

#### CX-04 Card

The {{entropy}} of an isolated system always increases.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("cloze");
    expect(card.resolvedFrom).toContain("inherited");
  });

  // CX-05: ### cloze + #### no {{}} -> cloze prose only -> skip (CLZ-01, CX-05)
  test("CX-05: cloze inherited with prose only (no deletions) -> skip cloze (CLZ-01, CX-05)", () => {
    const doc = `---
AnkiSync: on
---

### Section #anki/cardType/cloze

#### CX-05 Card

This is plain prose with no cloze deletions anywhere in the text.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("skip");
    expect(formatResolvedCardType(card.resolvedType)).toBe("cloze");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("CLZ-01");
    expect(ruleIds).toContain("CX-05");
  });

  // CX-06: anki_cardDefault: basic + cloze body, no type tag -> basic {{foo}} no ::: -> skip (FM-02, CX-06, BAS-01)
  test("CX-06: anki_cardDefault: basic with cloze body and no ::: delimiter -> skip basic (FM-02, CX-06, BAS-01)", () => {
    const doc = `---
AnkiSync: on
anki_cardDefault: basic
---

#### CX-06 Card

The {{entropy}} of an isolated system always increases.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("skip");
    expect(formatResolvedCardType(card.resolvedType)).toBe("basic");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("BAS-01");
    expect(ruleIds).toContain("CX-06");
    expect(ruleIds).toContain("FM-02");
  });

  // CX-07: anki_cardDefault: basic + {{word}} only -> basic ::: + bare {{}} -> sync + warn (BAS-03, CX-07)
  test("CX-07: anki_cardDefault: basic with bare {{word}} and ::: delimiter -> sync + warn (BAS-03, CX-07)", () => {
    const doc = `---
AnkiSync: on
anki_cardDefault: basic
---

#### CX-07 Card

What does {{mitochondria}} do?

:::

It produces ATP.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("basic");
    const warnMessages = card.messages.filter((m) => m.level === "warn");
    expect(warnMessages.some((m) => m.ruleId === "BAS-03")).toBe(true);
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("BAS-03");
    expect(ruleIds).toContain("CX-07");
  });

  // CX-08: resolved basic -> basic no ::: -> skip (BAS-01, CX-08)
  test("CX-08: resolved basic card missing ::: delimiter -> skip (BAS-01, CX-08)", () => {
    const doc = `---
AnkiSync: on
anki_cardDefault: basic
---

#### CX-08 Card

Front content only with no split delimiter anywhere.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("skip");
    expect(formatResolvedCardType(card.resolvedType)).toBe("basic");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("BAS-01");
    expect(ruleIds).toContain("CX-08");
  });

  // CX-09: resolved basic (heading tag) -> basic :::r -> error (BAS-06, REV-04, CX-09)
  test("CX-09: section heading resolved basic with :::r delimiter -> error (BAS-06, REV-04, CX-09)", () => {
    const doc = `---
AnkiSync: on
anki_cardDefault: basic
---

### Section #anki/cardType/basic

#### CX-09 Card

Front question

:::r

Back answer
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("BAS-06");
    expect(ruleIds).toContain("REV-04");
    expect(ruleIds).toContain("CX-09");
  });

  // CX-10: resolved basic (heading tag) -> basic ::: Field -> error (BAS-06, CX-10)
  test("CX-10: resolved basic card with ::: Field delimiter -> error (BAS-06, CX-10)", () => {
    const doc = `---
AnkiSync: on
anki_customCardDefault: Vocab
---

#### CX-10 Card #anki/cardType/basic

Plain front text.

::: Word
invalid field on basic card
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("BAS-06");
    expect(ruleIds).toContain("CX-10");
  });

  // CX-11: resolved cloze -> cloze :::r or :::t -> error (CLZ-10, CX-11)
  test("CX-11: resolved cloze with :::t delimiter -> error (CLZ-10, CX-11)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-11 Card #anki/cardType/cloze

The {{mitochondria}} is important.

:::t

powerhouse
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("CLZ-10");
    expect(ruleIds).toContain("CX-11");
  });

  // CX-12: resolved cloze -> cloze {{}} only after ::: -> error (CLZ-11, CX-12)
  test("CX-12: resolved cloze with deletions only after ::: delimiter -> error (CLZ-11, CX-12)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-12 Card #anki/cardType/cloze

Prose in front without any cloze deletions.

:::

{{c1::Cloze only in back region}}
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("CLZ-11");
    expect(ruleIds).toContain("CX-12");
  });

  // CX-13: resolved cloze -> cloze valid Text {{}} -> sync (CLZ-01)
  test("CX-13: resolved cloze with valid Text {{}} deletions -> sync cloze (CLZ-01)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-13 Card #anki/cardType/cloze

The {{mitochondria}} is the {{powerhouse}} of the cell.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("cloze");
  });

  // CX-14: resolved reversible -> reversible ::: or :::r -> sync (REV-02, CX-14, RES-05)
  test("CX-14: resolved reversible via bare :::r delimiter -> sync reversible (REV-02, CX-14, RES-05)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-14 Card

Capital of France?

:::r

Paris
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("reversible");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("REV-02");
    expect(ruleIds).toContain("CX-14");
    expect(ruleIds).toContain("RES-05");
  });

  // CX-15: resolved reversible -> reversible no split -> skip (REV-03)
  test("CX-15: resolved reversible card missing split delimiter -> skip (REV-03)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-15 Card #anki/cardType/reversible

Front question without any delimiter.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("skip");
    expect(formatResolvedCardType(card.resolvedType)).toBe("reversible");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("REV-03");
  });

  // CX-16: #anki/cardType/reversible + :::r -> reversible split -> sync (redundant) (REV-02, CX-16)
  test("CX-16: #anki/cardType/reversible tag with redundant :::r delimiter -> sync reversible (REV-02, CX-16)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-16 Card #anki/cardType/reversible

Front question

:::r

Back answer
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("reversible");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("REV-02");
    expect(ruleIds).toContain("CX-16");
  });

  // CX-17: #anki/cardType/basic + :::r -> basic vs reversible signal -> error (REV-04, BAS-06, CX-17)
  test("CX-17: #anki/cardType/basic tag with conflicting :::r delimiter -> error (REV-04, BAS-06, CX-17)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-17 Card #anki/cardType/basic

Front question

:::r

Back answer
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("REV-04");
    expect(ruleIds).toContain("BAS-06");
    expect(ruleIds).toContain("CX-17");
  });

  // CX-18: resolved typed -> typed :::t or ::: -> sync (TYP-01, CX-18)
  test("CX-18: resolved typed card with :::t delimiter -> sync typed (TYP-01/TYP-03, CX-18)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-18 Card #anki/cardType/typed

Capital of France?

:::t

Paris
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("typed");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("CX-18");
  });

  // CX-19: resolved custom -> custom ::: Field × N -> sync (CUS-01)
  test("CX-19: resolved custom card with valid ::: Field blocks -> sync custom (CUS-01)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-19 Card #anki/noteType/Vocab

::: Word
mitochondria

::: Definition
powerhouse of the cell
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(card.resolvedType.kind).toBe("custom");
    expect(formatResolvedCardType(card.resolvedType)).toBe("Vocab");
  });

  // CX-20: resolved custom -> custom plain ::: only -> skip (CUS-04, CX-20)
  test("CX-20: resolved custom card with plain ::: delimiter only -> skip (CUS-04, CX-20)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-20 Card #anki/noteType/Vocab

Question text

:::

Answer text
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("skip");
    expect(card.resolvedType.kind).toBe("custom");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("CUS-04");
    expect(ruleIds).toContain("CX-20");
  });

  // CX-21: resolved custom -> custom :::r -> error (CUS-05, CX-21)
  test("CX-21: resolved custom card with reserved delimiter :::r -> error (CUS-05, CX-21)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-21 Card #anki/noteType/Vocab

::: Word
term

:::r
conflicting reversible delimiter
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("CUS-05");
    expect(ruleIds).toContain("CX-21");
  });

  // CX-22: ::: Field only, no note type, no anki_customCardDefault -> custom layout -> skip (CUS-03, CX-22)
  test("CX-22: orphan ::: Field blocks without note type or custom default -> skip (CUS-03, CX-22)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-22 Card

::: Word
entropy

::: Definition
measure of disorder
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("skip");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("CUS-03");
    expect(ruleIds).toContain("CX-22");
  });

  // CX-23: ### Unit A cloze then ## Unit B sibling -> basic (no inherit) ::: -> sync (RES-02)
  test("CX-23: sibling section does not inherit cloze from previous section -> sync basic (RES-02)", () => {
    const doc = `---
AnkiSync: on
---

### Unit A #anki/cardType/cloze

#### Card A
The {{cloze}} text.

## Unit B

#### CX-23 Card
Front question

:::

Back answer
`;
    const result = parseCardDocument(doc);
    expect(result.syncEligible).toBe(true);
    expect(result.cards).toHaveLength(2);
    const cardB = result.cards[1]!;
    expect(cardB.title).toBe("CX-23 Card");
    expect(cardB.outcome).toBe("sync");
    expect(formatResolvedCardType(cardB.resolvedType)).toBe("basic");
  });

  // CX-24: {{c1::x}} only in Back -> basic ::: -> sync basic (BAS-05)
  test("CX-24: basic card with manual cloze {{c1::x}} only in Back region -> sync basic (BAS-05)", () => {
    const doc = `---
AnkiSync: on
anki_cardDefault: basic
---

#### CX-24 Card

What is Einstein's mass-energy equivalence?

:::

It is expressed as {{c1::E=mc^2}} in the explanation.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("basic");
    // Should NOT warn BAS-04 because manual cloze is in Back, not in Text
    expect(card.messages.some((m) => m.ruleId === "BAS-04")).toBe(false);
  });

  // CX-25: resolved cloze + non-empty Text deletion + optional ::: Back Extra -> cloze valid -> sync (CLZ-02)
  test("CX-25: resolved cloze with valid Text deletion and optional Back Extra -> sync cloze (CLZ-02)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-25 Card #anki/cardType/cloze

The {{c1::mitochondria}} is the powerhouse of the cell.

:::

Additional reference notes in Back Extra.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("cloze");
  });

  // CX-26: two #anki/cardType/* on section -> error (TAG-01, CX-01, CX-26)
  test("CX-26: dual conflicting cardType tags on section heading -> error (TAG-01, CX-01, CX-26)", () => {
    const doc = `---
AnkiSync: on
---

### Bad Section #anki/cardType/cloze #anki/cardType/basic

#### CX-26 Card

Front question

:::

Back answer
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("TAG-01");
    expect(ruleIds).toContain("CX-01");
    expect(ruleIds).toContain("CX-26");
  });

  // CX-27: resolved basic -> basic {{c1::x}} in Text, default setting -> sync + warn (literal) (BAS-04, CX-27)
  test("CX-27: resolved basic with {{c1::x}} in Text region under default settings -> sync + warn literal (BAS-04, CX-27)", () => {
    const doc = `---
AnkiSync: on
anki_cardDefault: basic
---

#### CX-27 Card

The {{c1::mitochondria}} is essential for respiration.

:::

Energy production details.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("basic");
    const warnMessages = card.messages.filter((m) => m.level === "warn");
    expect(warnMessages.some((m) => m.ruleId === "BAS-04")).toBe(true);
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("BAS-04");
    expect(ruleIds).toContain("CX-27");
  });

  // CX-27a: resolved basic, inferClozeFromManualSyntaxOnBasic: true -> cloze (reclassified) -> sync (BAS-04, RES-06)
  test("CX-27a: resolved basic with inferClozeFromManualSyntaxOnBasic: true -> sync cloze reclassified (RES-06)", () => {
    const doc = `---
AnkiSync: on
anki_cardDefault: basic
---

#### CX-27a Card

The {{c1::mitochondria}} is essential for respiration.

:::

Energy production details.
`;
    const card = parseSingleCard(doc, {
      inferClozeFromManualSyntaxOnBasic: true,
    });
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("cloze");
    expect(card.messages.some((m) => m.ruleId === "BAS-04")).toBe(false);
    expect(card.messages.some((m) => m.ruleId === "RES-06")).toBe(true);
  });

  // CX-28: {{}} or {{c1::}} empty deletion -> cloze empty -> skip (CLZ-09, CX-28)
  test("CX-28: cloze card with empty deletion token {{}} -> skip cloze (CLZ-09, CX-28)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-28 Card #anki/cardType/cloze

Text containing an empty {{}} cloze deletion.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("skip");
    expect(formatResolvedCardType(card.resolvedType)).toBe("cloze");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("CLZ-09");
    expect(ruleIds).toContain("CX-28");
  });

  // CX-29: section #biology + #anki/cardType/cloze -> cloze valid -> sync; tag biology only (STR-04)
  test("CX-29: section heading with #biology and cloze tag -> sync cloze with user tag biology (STR-04)", () => {
    const doc = `---
AnkiSync: on
---

### Chapter #biology #anki/cardType/cloze

#### CX-29 Card

The {{mitochondria}} produces cellular ATP.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("sync");
    expect(formatResolvedCardType(card.resolvedType)).toBe("cloze");
    expect(card.hashtags.user).toContain("biology");
    expect(card.hashtags.user.some((tag) => tag.includes("anki"))).toBe(false);
    expect(card.hashtags.engine).toContain("#anki/cardType/cloze");
  });

  // CX-30: inherited cloze + :::r -> cloze vs reversible :::r -> error (RES-05, CLZ-10, CX-30)
  test("CX-30: inherited cloze card with :::r delimiter -> error (RES-05, CLZ-10, CX-30)", () => {
    const doc = `---
AnkiSync: on
---

### Section #anki/cardType/cloze

#### CX-30 Card

Inherited cloze {{token}} in Text.

:::r

Reversible back answer.
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("CLZ-10");
    expect(ruleIds).toContain("REV-05");
    expect(ruleIds).toContain("CX-30");
    expect(ruleIds).toContain("RES-05");
  });

  // CX-31: #anki/cardType/reversible + :::t (or both :::r and :::t) -> conflicting -> error (REV-06, CX-31)
  test("CX-31: #anki/cardType/reversible tag with conflicting :::t delimiter -> error (REV-06, CX-31)", () => {
    const doc = `---
AnkiSync: on
---

#### CX-31 Card #anki/cardType/reversible

Question text

:::t

Typed answer
`;
    const card = parseSingleCard(doc);
    expect(card.outcome).toBe("error");
    const ruleIds = card.messages.map((m) => m.ruleId);
    expect(ruleIds).toContain("REV-06");
    expect(ruleIds).toContain("CX-31");
  });

  // CX-32: bare :::t / :::r, no heading type (even with anki_cardDefault: basic) -> typed / reversible split -> sync (RES-05)
  test("CX-32: bare delimiters :::r and :::t promote before anki_cardDefault: basic -> sync (RES-05)", () => {
    const doc = `---
AnkiSync: on
anki_cardDefault: basic
---

#### CX-32a Reversible Card

Reversible question

:::r

Reversible answer

#### CX-32b Typed Card

Typed question

:::t

Typed answer
`;
    const result = parseCardDocument(doc);
    expect(result.syncEligible).toBe(true);
    expect(result.cards).toHaveLength(2);

    const cardR = result.cards[0]!;
    expect(cardR.title).toBe("CX-32a Reversible Card");
    expect(cardR.outcome).toBe("sync");
    expect(formatResolvedCardType(cardR.resolvedType)).toBe("reversible");
    const rRules = cardR.messages.map((m) => m.ruleId);
    expect(rRules).toContain("RES-05");
    expect(rRules).toContain("DEL-02");
    expect(rRules).toContain("CX-14");

    const cardT = result.cards[1]!;
    expect(cardT.title).toBe("CX-32b Typed Card");
    expect(cardT.outcome).toBe("sync");
    expect(formatResolvedCardType(cardT.resolvedType)).toBe("typed");
    const tRules = cardT.messages.map((m) => m.ruleId);
    expect(tRules).toContain("CX-18");
  });
});
