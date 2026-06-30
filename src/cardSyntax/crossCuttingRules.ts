import type { BuiltInCardType, CardMessage, ResolvedCardType } from "./types";
import type { CardLayoutRegions } from "./layoutValidator";

export interface CrossCuttingContext {
  cardTitle: string;
  resolvedType: ResolvedCardType;
  outcome: "sync" | "skip" | "error";
  regions: CardLayoutRegions;
  layoutRuleIds: string[];
  fileBuiltInDefault?: BuiltInCardType;
  cardHeadingBuiltinType?: BuiltInCardType;
  hasManualClozeInText: boolean;
  hasBareClozeInText: boolean;
  resolvedFrom?: string;
}

function hasRule(layoutRuleIds: string[], ruleId: string): boolean {
  return layoutRuleIds.includes(ruleId);
}

function hasSplit(regions: CardLayoutRegions): boolean {
  return (
    regions.hasPlainSplit ||
    regions.hasReversibleDelimiter ||
    regions.hasTypedDelimiter
  );
}

function backHasMultipleNonemptyLines(back?: string): boolean {
  if (!back) {
    return false;
  }
  const lines = back
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 1;
}

/**
 * Section 11 companion CX-* rule IDs for layout outcomes (spec matrix).
 */
export function deriveCrossCuttingRuleIds(
  context: CrossCuttingContext,
): string[] {
  const rules: string[] = [];
  const { layoutRuleIds, resolvedType, regions, outcome } = context;

  if (hasRule(layoutRuleIds, "BAS-03")) {
    rules.push("CX-07");
  }

  if (hasRule(layoutRuleIds, "BAS-04")) {
    rules.push("CX-27");
  }

  if (
    resolvedType.kind === "builtin" &&
    resolvedType.type === "cloze" &&
    context.resolvedFrom?.includes("inferred from {{cN::")
  ) {
    rules.push("RES-06");
  }

  if (
    hasRule(layoutRuleIds, "BAS-06") &&
    resolvedType.kind === "builtin" &&
    resolvedType.type === "basic" &&
    regions.fieldBlocks.length > 0
  ) {
    rules.push("CX-10");
  }

  if (hasRule(layoutRuleIds, "CUS-04")) {
    rules.push("CX-20");
  }

  if (
    hasRule(layoutRuleIds, "CLZ-10") &&
    regions.hasReversibleDelimiter &&
    resolvedType.kind === "builtin" &&
    resolvedType.type === "cloze"
  ) {
    rules.push("CX-30", "RES-05");
  }

  if (hasRule(layoutRuleIds, "CUS-03")) {
    rules.push("CX-22");
  }

  if (hasRule(layoutRuleIds, "BAS-01")) {
    if (
      context.fileBuiltInDefault === "basic" &&
      (context.hasBareClozeInText || context.hasManualClozeInText) &&
      !regions.hasPlainSplit &&
      !regions.hasReversibleDelimiter &&
      !regions.hasTypedDelimiter
    ) {
      rules.push("CX-06", "FM-02");
    } else if (
      resolvedType.kind === "builtin" &&
      resolvedType.type === "basic" &&
      outcome === "skip"
    ) {
      rules.push("CX-08");
    }
  }

  if (hasRule(layoutRuleIds, "CLZ-01")) {
    rules.push("CX-05");
  }

  if (hasRule(layoutRuleIds, "CLZ-11")) {
    rules.push("CX-12");
  }

  if (hasRule(layoutRuleIds, "CLZ-09")) {
    rules.push("CX-28");
  }

  if (hasRule(layoutRuleIds, "CLZ-10")) {
    rules.push("CX-11");
  }

  if (hasRule(layoutRuleIds, "REV-04")) {
    if (context.cardHeadingBuiltinType === "basic") {
      rules.push("CX-17");
    } else if (
      resolvedType.kind === "builtin" &&
      resolvedType.type === "basic" &&
      context.fileBuiltInDefault === "basic"
    ) {
      rules.push("CX-09", "BAS-06");
    }
  }

  if (hasRule(layoutRuleIds, "CUS-05")) {
    rules.push("CX-21");
  }

  if (
    resolvedType.kind === "builtin" &&
    resolvedType.type === "reversible" &&
    outcome === "sync" &&
    hasSplit(regions)
  ) {
    rules.push("REV-02");
    if (context.cardHeadingBuiltinType === "reversible") {
      rules.push("CX-16");
    }
    if (regions.hasReversibleDelimiter) {
      rules.push("DEL-02", "DEL-06", "RES-05", "CX-14");
    }
  }

  if (
    resolvedType.kind === "builtin" &&
    resolvedType.type === "typed" &&
    outcome === "sync" &&
    hasSplit(regions)
  ) {
    if (regions.hasTypedDelimiter) {
      rules.push("TYP-03");
      if (backHasMultipleNonemptyLines(regions.backRegion)) {
        rules.push("TYP-04");
      }
    } else {
      rules.push("TYP-01", "TYP-02");
    }
    rules.push("CX-18");
  }

  return rules;
}

export function crossCuttingMessages(
  context: CrossCuttingContext,
  existingRuleIds: Set<string>,
): CardMessage[] {
  const messages: CardMessage[] = [];

  for (const ruleId of deriveCrossCuttingRuleIds(context)) {
    if (existingRuleIds.has(ruleId)) {
      continue;
    }
    existingRuleIds.add(ruleId);
    messages.push({
      level: "info",
      text: `Card "${context.cardTitle}": ${ruleId} applies`,
      ruleId,
    });
  }

  return messages;
}
