import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getBodyStartOffset } from "../../src/io/frontmatterFilter";
import { parseCardDocument } from "../../src/cardSyntax/parseCardDocument";
import {
  DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
  formatResolvedCardType,
} from "../../src/cardSyntax/types";
import {
  extractStressExpectations,
  type StressExpectation,
} from "./stress-test.integration.test";

const FIXTURE_PATH = join(
  import.meta.dir,
  "../fixtures/new format/card-syntax-orphan-custom.md",
);

function findCardById(
  cards: { title: string }[],
  cardId: string,
): (typeof cards)[number] | undefined {
  return cards.find(
    (card) =>
      card.title.startsWith(`${cardId} `) ||
      card.title === cardId ||
      card.title.startsWith(cardId),
  );
}

function assertOrphanExpectation(
  card: NonNullable<ReturnType<typeof findCardById>> & {
    outcome: string;
    messages: { level: string; ruleId?: string; text: string }[];
    resolvedType: { kind: string; type?: string };
  },
  expectation: StressExpectation,
): void {
  expect(card.outcome).toBe(expectation.outcome);

  if (expectation.resolved) {
    const formatted = formatResolvedCardType(
      card.resolvedType as Parameters<typeof formatResolvedCardType>[0],
    );
    const hint = expectation.resolved.toLowerCase();
    if (hint.includes("cloze")) {
      expect(formatted).toBe("cloze");
    }
  }

  if (expectation.message) {
    const haystack = card.messages.map((message) => message.text).join(" ");
    expect(haystack.toLowerCase()).toContain(expectation.message.toLowerCase());
  }

  for (const ruleId of expectation.rules) {
    expect(
      card.messages.some((message) => message.ruleId === ruleId),
      `${expectation.cardId}: expected rule ${ruleId}`,
    ).toBe(true);
  }
}

describe("card-syntax-orphan-custom.md integration", () => {
  test("parseCardDocument resolves orphan-custom fixture per <!-- expect: -->", async () => {
    const rawText = await readFile(FIXTURE_PATH, "utf8");
    const expectations = extractStressExpectations(rawText);

    expect(expectations).toHaveLength(2);

    const result = parseCardDocument(rawText, {
      ...DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
      bodyStartOffset: getBodyStartOffset(rawText),
    });

    expect(result.syncEligible).toBe(true);
    expect(result.fileDefaults.builtInDefault).toBeUndefined();
    expect(result.fileDefaults.customNoteTypeDefault).toBeUndefined();
    expect(result.cards).toHaveLength(2);

    for (const expectation of expectations) {
      const card = findCardById(result.cards, expectation.cardId);
      expect(card, `${expectation.cardId} missing`).toBeDefined();
      assertOrphanExpectation(card!, expectation);
    }
  });
});
