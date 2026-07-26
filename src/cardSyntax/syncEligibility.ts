import type { CardMessage, ResolvedCard, SyncOutcome } from "./types";

function messageLevelToOutcome(
  level: CardMessage["level"],
): SyncOutcome | undefined {
  if (level === "error") {
    return "error";
  }
  if (level === "warn") {
    return "warn";
  }
  if (level === "skip") {
    return "skip";
  }
  return undefined;
}

/**
 * Preview-facing outcome: upgrades `sync` when warn/skip messages are present.
 * Matches plugin `effectivePreviewOutcome` so sync gating mirrors the chip.
 */
export function effectiveCardOutcome(
  card: Pick<ResolvedCard, "outcome" | "messages">,
): SyncOutcome {
  let effective = card.outcome;
  for (const message of card.messages) {
    const mapped = messageLevelToOutcome(message.level);
    if (!mapped) {
      continue;
    }
    if (mapped === "error") {
      return "error";
    }
    if (mapped === "warn" && effective === "sync") {
      effective = "warn";
    }
    if (mapped === "skip" && effective === "sync") {
      effective = "skip";
    }
  }
  return effective;
}

/** Phase 1 gate: skip/error never write; sync/warn may write (01 D1–D3). */
export function isAnkiWriteAllowed(outcome: SyncOutcome): boolean {
  return outcome === "sync" || outcome === "warn";
}

export function collectPreviewWarnings(
  card: Pick<ResolvedCard, "messages">,
): string[] {
  return card.messages
    .filter((message) => message.level === "warn")
    .map((message) =>
      message.ruleId ? `${message.ruleId}: ${message.text}` : message.text,
    );
}
