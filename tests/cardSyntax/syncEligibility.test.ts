import { describe, expect, test } from "bun:test";
import {
  effectiveCardOutcome,
  isAnkiWriteAllowed,
} from "../../src/cardSyntax/syncEligibility";
import type { ResolvedCard } from "../../src/cardSyntax/types";

function card(
  partial: Pick<ResolvedCard, "outcome" | "messages">,
): Pick<ResolvedCard, "outcome" | "messages"> {
  return partial;
}

describe("syncEligibility", () => {
  test("allows write for sync and warn outcomes", () => {
    expect(isAnkiWriteAllowed("sync")).toBe(true);
    expect(isAnkiWriteAllowed("warn")).toBe(true);
  });

  test("hard-blocks skip and error outcomes", () => {
    expect(isAnkiWriteAllowed("skip")).toBe(false);
    expect(isAnkiWriteAllowed("error")).toBe(false);
  });

  test("effectiveCardOutcome upgrades sync to warn when warn messages exist", () => {
    expect(
      effectiveCardOutcome(
        card({
          outcome: "sync",
          messages: [
            {
              level: "warn",
              text: 'Card "X": literal cloze — warning',
              ruleId: "BAS-04",
            },
          ],
        }),
      ),
    ).toBe("warn");
  });

  test("effectiveCardOutcome keeps skip/error authoritative", () => {
    expect(
      effectiveCardOutcome(
        card({
          outcome: "skip",
          messages: [{ level: "warn", text: "noise", ruleId: "BAS-04" }],
        }),
      ),
    ).toBe("skip");
    expect(
      effectiveCardOutcome(
        card({
          outcome: "error",
          messages: [{ level: "skip", text: "noise", ruleId: "BAS-01" }],
        }),
      ),
    ).toBe("error");
  });
});
