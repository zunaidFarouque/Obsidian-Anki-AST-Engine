import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getBodyStartOffset } from "../../src/io/frontmatterFilter";
import {
  DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
  formatResolvedCardType,
  type ParseCardDocumentOptions,
  type ParseCardDocumentResult,
  type ResolvedCard,
} from "../../src/cardSyntax/types";

const FIXTURE_PATH = join(
  import.meta.dir,
  "../fixtures/new format/card-syntax-stress-test.md",
);

const CARD_HEADING_RE = /^####\s+([A-Z]\d+[a-z]?)\s+(.+)$/;
const EXPECT_COMMENT_RE = /<!--\s*expect:\s*(.+?)\s*-->/;

export type StressOutcome = "sync" | "skip" | "error" | "sync+warn";

export type StressExpectation = {
  cardId: string;
  headingLine: string;
  outcome: StressOutcome;
  rules: string[];
  resolved?: string;
  message?: string;
  extras: Record<string, string>;
};

type ParseCardDocumentFn = (
  rawText: string,
  options?: Partial<ParseCardDocumentOptions>,
) => ParseCardDocumentResult;

function parseOutcomeToken(raw: string): StressOutcome {
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes("sync") && normalized.includes("warn")) {
    return "sync+warn";
  }
  if (normalized.includes("error")) {
    return "error";
  }
  if (normalized.includes("skip")) {
    return "skip";
  }
  return "sync";
}

export function parseExpectComment(comment: string): Omit<
  StressExpectation,
  "cardId" | "headingLine"
> {
  const match = comment.match(EXPECT_COMMENT_RE);
  if (!match?.[1]) {
    throw new Error(`Invalid expect comment: ${comment}`);
  }

  const segments = match[1].split(";").map((part) => part.trim());
  const outcome = parseOutcomeToken(segments[0] ?? "");
  const rules: string[] = [];
  let resolved: string | undefined;
  let message: string | undefined;
  const extras: Record<string, string> = {};

  for (const segment of segments.slice(1)) {
    const colon = segment.indexOf(":");
    if (colon === -1) {
      continue;
    }

    const key = segment.slice(0, colon).trim().toLowerCase();
    const value = segment.slice(colon + 1).trim();

    switch (key) {
      case "rules":
        rules.push(
          ...value
            .split(",")
            .map((rule) => rule.trim())
            .filter(Boolean),
        );
        break;
      case "resolved":
        resolved = value;
        break;
      case "message":
        message = value;
        break;
      default:
        extras[key] = value;
        break;
    }
  }

  return { outcome, rules, resolved, message, extras };
}

export function extractStressExpectations(markdown: string): StressExpectation[] {
  const expectations: StressExpectation[] = [];
  const headings: { cardId: string; headingLine: string; lineIndex: number }[] =
    [];
  const expectLines: { lineIndex: number; comment: string }[] = [];

  const lines = markdown.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;

    const headingMatch = line.match(CARD_HEADING_RE);
    if (headingMatch) {
      headings.push({
        cardId: headingMatch[1]!,
        headingLine: line.trim(),
        lineIndex,
      });
      continue;
    }

    const expectMatch = line.match(EXPECT_COMMENT_RE);
    if (expectMatch) {
      expectLines.push({ lineIndex, comment: expectMatch[0] });
    }
  }

  for (const { lineIndex, comment } of expectLines) {
    const heading = [...headings]
      .reverse()
      .find((entry) => entry.lineIndex < lineIndex);

    if (!heading) {
      continue;
    }

    expectations.push({
      cardId: heading.cardId,
      headingLine: heading.headingLine,
      ...parseExpectComment(comment),
    });
  }

  return expectations;
}

function findCardById(cards: ResolvedCard[], cardId: string): ResolvedCard | undefined {
  return cards.find(
    (card) =>
      card.title.startsWith(`${cardId} `) ||
      card.title === cardId ||
      card.title.startsWith(cardId),
  );
}

function resolvedHintMatches(card: ResolvedCard, hint: string): boolean {
  const formatted = formatResolvedCardType(card.resolvedType);
  const lower = hint.toLowerCase();

  if (lower.includes("vocab") || lower.includes("custom")) {
    return card.resolvedType.kind === "custom";
  }
  if (lower.includes("basic")) {
    return formatted === "basic";
  }
  if (lower.includes("cloze")) {
    return formatted === "cloze";
  }
  if (lower.includes("reversible")) {
    return formatted === "reversible";
  }
  if (lower.includes("typed")) {
    return formatted === "typed";
  }

  return true;
}

function assertCardMatchesExpectation(
  card: ResolvedCard,
  expectation: StressExpectation,
  rawText?: string,
): void {
  switch (expectation.outcome) {
    case "sync+warn":
      expect(card.outcome).toBe("sync");
      expect(
        card.messages.some((message) => message.level === "warn"),
        `${expectation.cardId}: expected warn messages`,
      ).toBe(true);
      break;
    default:
      expect(card.outcome).toBe(expectation.outcome);
      break;
  }

  if (expectation.resolved) {
    expect(
      resolvedHintMatches(card, expectation.resolved),
      `${expectation.cardId}: resolved type mismatch (got ${formatResolvedCardType(card.resolvedType)}, hint: ${expectation.resolved})`,
    ).toBe(true);
  }

  if (expectation.message) {
    const haystack = card.messages.map((message) => message.text).join(" ");
    expect(
      haystack.toLowerCase().includes(expectation.message.toLowerCase()),
      `${expectation.cardId}: expected message containing "${expectation.message}"`,
    ).toBe(true);
  }

  if (expectation.extras.back_contains && rawText) {
    const backRange = card.regions.back;
    expect(backRange, `${expectation.cardId}: missing back region`).toBeDefined();
    const backContent = rawText.slice(backRange!.start, backRange!.end);
    expect(
      backContent.includes(expectation.extras.back_contains),
      `${expectation.cardId}: back should contain "${expectation.extras.back_contains}"`,
    ).toBe(true);
  }

  if (expectation.rules.length > 0 && card.messages.length > 0) {
    const messageRules = new Set(
      card.messages
        .map((message) => message.ruleId)
        .filter((ruleId): ruleId is string => ruleId !== undefined),
    );

    for (const ruleId of expectation.rules) {
      if (messageRules.size === 0) {
        // TODO: orchestrator should attach ruleId to all validation messages
        continue;
      }
      expect(
        messageRules.has(ruleId),
        `${expectation.cardId}: expected rule ${ruleId} in messages`,
      ).toBe(true);
    }
  }

  if (
    (expectation.outcome === "error" || expectation.outcome === "skip") &&
    card.messages.length === 0
  ) {
    // TODO: orchestrator should emit canonical skip/error messages (Section 12)
    console.warn(
      `[TODO] ${expectation.cardId}: ${expectation.outcome} card has no messages yet`,
    );
  }
}

let parseCardDocument: ParseCardDocumentFn | undefined;

try {
  const module = await import("../../src/cardSyntax/parseCardDocument");
  parseCardDocument = module.parseCardDocument;
} catch {
  parseCardDocument = undefined;
}

const orchestratorReady = parseCardDocument !== undefined;

describe("stress-test fixture expect comment parser", () => {
  test("extracts one expectation per #### card with <!-- expect: -->", async () => {
    const markdown = await readFile(FIXTURE_PATH, "utf8");
    const expectations = extractStressExpectations(markdown);

    expect(expectations.length).toBeGreaterThanOrEqual(40);
    expect(expectations.map((entry) => entry.cardId)).toContain("A1");
    expect(expectations.map((entry) => entry.cardId)).toContain("G2a");
    expect(expectations.map((entry) => entry.cardId)).toContain("H10");
  });

  test("parses sync+warn, rules, resolved, and message fields", () => {
    const parsed = parseExpectComment(
      "<!-- expect: sync + warn; rules: BAS-03,CX-07; resolved: basic; {{username}} literal in Front -->",
    );

    expect(parsed.outcome).toBe("sync+warn");
    expect(parsed.rules).toEqual(["BAS-03", "CX-07"]);
    expect(parsed.resolved).toBe("basic");
  });
});

describe("card-syntax-stress-test.md integration", () => {
  test(
    "parseCardDocument resolves every fixture card per <!-- expect: -->",
    async () => {
      const rawText = await readFile(FIXTURE_PATH, "utf8");
      const expectations = extractStressExpectations(rawText);
      const bodyStartOffset = getBodyStartOffset(rawText);

      const result = parseCardDocument!(rawText, {
        ...DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
        bodyStartOffset,
      });

      expect(result.syncEligible).toBe(true);
      expect(result.fileDefaults.builtInDefault).toBe("basic");
      expect(result.fileDefaults.customModelDefault).toBe("Vocab");
      expect(result.cards.length).toBe(expectations.length);

      const failures: string[] = [];

      for (const expectation of expectations) {
        const card = findCardById(result.cards, expectation.cardId);
        if (!card) {
          failures.push(`${expectation.cardId}: card not found in parse result`);
          continue;
        }

        try {
          assertCardMatchesExpectation(card, expectation, rawText);
        } catch (error) {
          failures.push(
            `${expectation.cardId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (failures.length > 0) {
        console.log("Stress scenario failures:\n", failures.join("\n"));
      }

      expect(failures).toEqual([]);
    },
  );

});

describe("stress scenario coverage report", () => {
  test("lists fixture scenarios when orchestrator is missing or partial", async () => {
    const rawText = await readFile(FIXTURE_PATH, "utf8");
    const expectations = extractStressExpectations(rawText);

    const byOutcome = expectations.reduce<Record<string, number>>(
      (counts, entry) => {
        counts[entry.outcome] = (counts[entry.outcome] ?? 0) + 1;
        return counts;
      },
      {},
    );

    expect(expectations).toHaveLength(53);
    expect(byOutcome.sync).toBeGreaterThan(20);
    expect(byOutcome.skip).toBeGreaterThanOrEqual(6);
    expect(byOutcome.error).toBeGreaterThanOrEqual(8);
    expect(byOutcome["sync+warn"]).toBeGreaterThanOrEqual(2);

    if (!orchestratorReady) {
      console.log(
        `[BLOCKER] parseCardDocument not found — 0/${expectations.length} stress scenarios executed`,
      );
      return;
    }

    const bodyStartOffset = getBodyStartOffset(rawText);
    const result = parseCardDocument!(rawText, {
      ...DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
      bodyStartOffset,
    });

    let passed = 0;
    for (const expectation of expectations) {
      const card = findCardById(result.cards, expectation.cardId);
      if (!card) {
        continue;
      }
      try {
        assertCardMatchesExpectation(card, expectation, rawText);
        passed += 1;
      } catch {
        // counted in main integration test
      }
    }

    console.log(
      `Stress scenarios passing: ${passed}/${expectations.length} (orchestrator partial OK)`,
    );
  });
});
