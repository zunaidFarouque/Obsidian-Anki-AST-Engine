import { describe, expect, test } from "bun:test";
import { getBodyStartOffset } from "../../src/io/frontmatterFilter";
import { DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS } from "../../src/cardSyntax/types";
import { parseCardDocument } from "../../src/cardSyntax/parseCardDocument";

const SYNC_HEADER = `---
AnkiSync: on
---

`;

function parseCustomDoc(
  body: string,
  options?: Partial<Parameters<typeof parseCardDocument>[1]>,
) {
  const fullText = SYNC_HEADER + body;
  return parseCardDocument(fullText, {
    ...DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
    bodyStartOffset: getBodyStartOffset(fullText),
    noteTypeFieldNamesByNoteType: {
      Vocab: ["Word", "Definition", "Example"],
    },
    ...options,
  });
}

describe("customCard — AST fields and injection offset", () => {
  test("extracts customFields array on resolved custom card", () => {
    const text = `#### Term #anki/noteType/Vocab

::: Word
Entropy

::: Definition
A measure of molecular randomness or disorder.

::: Example
Ice melting into water.
`;
    const result = parseCustomDoc(text);
    expect(result.cards).toHaveLength(1);
    const card = result.cards[0]!;
    expect(card.outcome).toBe("sync");
    expect(card.resolvedType).toEqual({ kind: "custom", noteTypeId: "Vocab" });
    expect(card.customFields).toBeDefined();
    expect(card.customFields!).toHaveLength(3);
    expect(card.customFields![0].name).toBe("Word");
    expect(card.customFields![1].name).toBe("Definition");
    expect(card.customFields![2].name).toBe("Example");
  });

  test("places injectionOffset at the tail of the last field block", () => {
    const text = `#### Term #anki/noteType/Vocab

::: Word
Entropy

::: Definition
A measure of molecular randomness or disorder.
`;
    const fullText = SYNC_HEADER + text;
    const result = parseCustomDoc(text);
    const card = result.cards[0]!;
    expect(card.injectionOffset).toBeDefined();

    // The injection offset must be AFTER "disorder.", not after "Entropy"
    const entropyPos = fullText.indexOf("Entropy");
    const disorderPos = fullText.indexOf("disorder.");
    expect(card.injectionOffset!).toBeGreaterThan(disorderPos);
    expect(card.injectionOffset!).toBeGreaterThan(entropyPos);
  });

  test("handles empty last field block by placing injectionOffset after delimiter", () => {
    const text = `#### Term #anki/noteType/Vocab

::: Word
Entropy

::: Definition
`;
    const fullText = SYNC_HEADER + text;
    const result = parseCustomDoc(text);
    const card = result.cards[0]!;
    expect(card.injectionOffset).toBeDefined();

    const defDelimiterPos = fullText.indexOf("::: Definition");
    expect(card.injectionOffset!).toBeGreaterThanOrEqual(
      defDelimiterPos + "::: Definition".length,
    );
  });

  test("does not set injectionOffset when card already has anki-id", () => {
    const text = `#### Term #anki/noteType/Vocab

::: Word
Entropy

::: Definition
A measure of molecular randomness.

<!--anki-id: 11111111-2222-3333-4444-555555555555-->
`;
    const result = parseCustomDoc(text);
    const card = result.cards[0]!;
    expect(card.ankiId).toBe("11111111-2222-3333-4444-555555555555");
    expect(card.injectionOffset).toBeUndefined();
  });
});
