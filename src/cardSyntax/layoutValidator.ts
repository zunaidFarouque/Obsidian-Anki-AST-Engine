import { processClozeDeletions } from "./clozeProcessor";

export type BuiltInCardType = "basic" | "cloze" | "reversible" | "typed";

export type ResolvedCardType =
  | { kind: "builtin"; type: BuiltInCardType }
  | { kind: "custom"; noteTypeId: string; fieldNames: string[] };

export interface CardFieldBlock {
  fieldName: string;
  content: string;
}

export interface CardLayoutRegions {
  cardTitle: string;
  textRegion: string;
  backRegion?: string;
  hasPlainSplit: boolean;
  hasReversibleDelimiter: boolean;
  hasTypedDelimiter: boolean;
  hasEmbeddedReversibleDelimiter?: boolean;
  hasEmbeddedTypedDelimiter?: boolean;
  fieldBlocks: CardFieldBlock[];
}

export interface LayoutValidatorOptions {
  cardTitle?: string;
  inferClozeFromManualSyntaxOnBasic?: boolean;
  /** True when a custom note type default is set but the card resolved to a builtin type. */
  customNoteTypeDefaultAvailable?: boolean;
}

export type LayoutOutcome = "sync" | "skip" | "error";

export type LayoutMessageKind = "error" | "warn" | "info";

export interface LayoutMessage {
  kind: LayoutMessageKind;
  ruleId: string;
  message: string;
}

export interface LayoutValidationResult {
  outcome: LayoutOutcome;
  messages: LayoutMessage[];
  effectiveType?: ResolvedCardType;
  typedBackPlainText?: string;
}

const CLOZE_PATTERN = /\{\{([^}]*)\}\}/g;

function cardLabel(regions: CardLayoutRegions, options: LayoutValidatorOptions): string {
  return options.cardTitle ?? regions.cardTitle;
}

function pushMessage(
  messages: LayoutMessage[],
  kind: LayoutMessageKind,
  ruleId: string,
  message: string,
): void {
  messages.push({ kind, ruleId, message });
}

function hasSplit(regions: CardLayoutRegions): boolean {
  return (
    regions.hasPlainSplit ||
    regions.hasReversibleDelimiter ||
    regions.hasTypedDelimiter
  );
}

function findClozeTokens(text: string): string[] {
  return [...text.matchAll(CLOZE_PATTERN)].map((match) => match[1] ?? "");
}

function isManualCloze(inner: string): boolean {
  return /^c\d+::/s.test(inner);
}

function isBareClozeToken(inner: string): boolean {
  return inner.trim().length > 0 && !isManualCloze(inner);
}

function hasManualClozeInText(text: string): boolean {
  return findClozeTokens(text).some(isManualCloze);
}

function hasBareClozeInText(text: string): boolean {
  return findClozeTokens(text).some(isBareClozeToken);
}

function hasEmptyClozeDeletion(text: string): boolean {
  return [...text.matchAll(CLOZE_PATTERN)].some((match) => {
    const inner = match[1] ?? "";
    return inner.trim().length === 0;
  });
}

function hasReservedDelimiterConflict(regions: CardLayoutRegions): boolean {
  return (
    regions.hasReversibleDelimiter ||
    regions.hasTypedDelimiter ||
    regions.hasEmbeddedReversibleDelimiter === true ||
    regions.hasEmbeddedTypedDelimiter === true
  );
}

function hasValidClozeInText(text: string): boolean {
  const result = processClozeDeletions(text, { allowShorthand: true });
  if (!result.valid) {
    return false;
  }
  return findClozeTokens(text).some((inner) => inner.trim().length > 0);
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

/**
 * TYP-05: split a typed first-line answer on `|`, trim each segment, drop empties.
 * Authoring may use spaces around pipes (`Paris | Lyon`); Anki Back stores `Paris|Lyon`.
 */
export function parseTypedAcceptableAnswers(firstLinePlain: string): string[] {
  return firstLinePlain
    .split("|")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

/** Join TYP-05 alternatives for the Anki type-in Back field (no spaces around `|`). */
export function formatTypedAnswersForAnki(answers: string[]): string {
  return answers.join("|");
}

/**
 * TYP-03/04/05: first non-empty line → strip HTML/markdown → pipe-split alternatives.
 */
export function extractTypedBackPlainText(backRegion: string): string {
  const withoutHtml = stripHtmlTags(backRegion);
  const withoutMarkdown = stripMarkdownInline(withoutHtml);
  const normalized = decodeHtmlEntities(withoutMarkdown);
  for (const line of normalized.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return formatTypedAnswersForAnki(parseTypedAcceptableAnswers(trimmed));
    }
  }
  return "";
}

function conflictError(
  title: string,
  delimiter: ":::r" | ":::t",
  resolvedType: string,
  ruleId: string,
): LayoutMessage {
  return {
    kind: "error",
    ruleId,
    message: `Card "${title}": ${delimiter} conflicts with resolved type "${resolvedType}" — error`,
  };
}

function validateBasicLayout(
  resolvedType: ResolvedCardType,
  regions: CardLayoutRegions,
  options: LayoutValidatorOptions,
  messages: LayoutMessage[],
): LayoutValidationResult {
  const title = cardLabel(regions, options);
  let effectiveType: ResolvedCardType = resolvedType;

  if (regions.hasReversibleDelimiter) {
    messages.push(
      conflictError(title, ":::r", "basic", "BAS-06"),
    );
    messages.push(
      conflictError(title, ":::r", "basic", "REV-04"),
    );
    return { outcome: "error", messages, effectiveType };
  }

  if (regions.hasTypedDelimiter) {
    messages.push(
      conflictError(title, ":::t", "basic", "BAS-06"),
    );
    return { outcome: "error", messages, effectiveType };
  }

  if (
    regions.fieldBlocks.length > 0 &&
    options.customNoteTypeDefaultAvailable
  ) {
    pushMessage(
      messages,
      "error",
      "BAS-06",
      `Card "${title}": layout conflicts with resolved type "basic" — error`,
    );
    return { outcome: "error", messages, effectiveType };
  }

  if (!regions.hasPlainSplit) {
    pushMessage(
      messages,
      "error",
      "BAS-01",
      `Card "${title}": basic card missing ::: delimiter — skipped`,
    );
    return { outcome: "skip", messages, effectiveType };
  }

  if (hasManualClozeInText(regions.textRegion)) {
    if (options.inferClozeFromManualSyntaxOnBasic) {
      effectiveType = { kind: "builtin", type: "cloze" };
      return validateClozeLayout(effectiveType, regions, options, messages, effectiveType);
    }

    pushMessage(
      messages,
      "warn",
      "BAS-04",
      `Card "${title}": {{cN::...}} treated as literal on basic card (enable inferClozeFromManualSyntaxOnBasic to sync as cloze) — warning`,
    );
  }

  if (hasBareClozeInText(regions.textRegion)) {
    const bareMatch = findClozeTokens(regions.textRegion).find(isBareClozeToken);
    pushMessage(
      messages,
      "warn",
      "BAS-03",
      `Card "${title}": {{${bareMatch ?? "word"}}} treated as literal on basic card — warning`,
    );
  }

  return { outcome: "sync", messages, effectiveType };
}

function validateClozeLayout(
  resolvedType: ResolvedCardType,
  regions: CardLayoutRegions,
  options: LayoutValidatorOptions,
  messages: LayoutMessage[],
  effectiveType: ResolvedCardType = resolvedType,
): LayoutValidationResult {
  const title = cardLabel(regions, options);

  if (hasEmptyClozeDeletion(regions.textRegion)) {
    pushMessage(
      messages,
      "error",
      "CLZ-09",
      `Card "${title}": empty cloze deletion — skipped`,
    );
    return { outcome: "skip", messages, effectiveType };
  }

  if (regions.hasReversibleDelimiter) {
    messages.push(conflictError(title, ":::r", "cloze", "CLZ-10"));
    messages.push({
      kind: "error",
      ruleId: "REV-05",
      message: `Card "${title}": :::r conflicts with resolved type "cloze" — error`,
    });
    return { outcome: "error", messages, effectiveType };
  }

  if (regions.hasTypedDelimiter) {
    messages.push(conflictError(title, ":::t", "cloze", "CLZ-10"));
    return { outcome: "error", messages, effectiveType };
  }

  if (hasValidClozeInText(regions.textRegion)) {
    return { outcome: "sync", messages, effectiveType };
  }

  if (
    regions.hasPlainSplit &&
    hasValidClozeInText(regions.backRegion ?? "")
  ) {
    pushMessage(
      messages,
      "error",
      "CLZ-11",
      `Card "${title}": cloze deletions only in Back region — error`,
    );
    return { outcome: "error", messages, effectiveType };
  }

  pushMessage(
    messages,
    "error",
    "CLZ-01",
    `Card "${title}": cloze card has no {{}} deletions in Text region — skipped`,
  );
  return { outcome: "skip", messages, effectiveType };
}

function hasTypedSignal(regions: CardLayoutRegions): boolean {
  return (
    regions.hasTypedDelimiter || regions.hasEmbeddedTypedDelimiter === true
  );
}

function hasReversibleSignal(regions: CardLayoutRegions): boolean {
  return (
    regions.hasReversibleDelimiter ||
    regions.hasEmbeddedReversibleDelimiter === true
  );
}

function validateReversibleLayout(
  regions: CardLayoutRegions,
  options: LayoutValidatorOptions,
  messages: LayoutMessage[],
): LayoutValidationResult {
  const title = cardLabel(regions, options);

  if (hasTypedSignal(regions)) {
    messages.push(conflictError(title, ":::t", "reversible", "REV-06"));
    return { outcome: "error", messages };
  }

  if (!hasSplit(regions)) {
    pushMessage(
      messages,
      "error",
      "REV-03",
      `Card "${title}": reversible card missing front/back split — skipped`,
    );
    return { outcome: "skip", messages };
  }

  return { outcome: "sync", messages };
}

function validateTypedLayout(
  regions: CardLayoutRegions,
  options: LayoutValidatorOptions,
  messages: LayoutMessage[],
): LayoutValidationResult {
  const title = cardLabel(regions, options);

  if (hasReversibleSignal(regions)) {
    messages.push(conflictError(title, ":::r", "typed", "REV-06"));
    return { outcome: "error", messages };
  }

  if (!hasSplit(regions)) {
    pushMessage(
      messages,
      "error",
      "TYP-02",
      `Card "${title}": typed card missing front/back split — skipped`,
    );
    return { outcome: "skip", messages };
  }

  const typedBackPlainText = extractTypedBackPlainText(regions.backRegion ?? "");
  return { outcome: "sync", messages, typedBackPlainText };
}

function validateCustomLayout(
  resolvedType: Extract<ResolvedCardType, { kind: "custom" }>,
  regions: CardLayoutRegions,
  options: LayoutValidatorOptions,
  messages: LayoutMessage[],
): LayoutValidationResult {
  const title = cardLabel(regions, options);

  if (hasReservedDelimiterConflict(regions)) {
    const delimiter = regions.hasReversibleDelimiter ||
      regions.hasEmbeddedReversibleDelimiter
      ? ":::r"
      : ":::t";
    pushMessage(
      messages,
      "error",
      "CUS-05",
      `Card "${title}": ${delimiter} conflicts with resolved custom note type "${resolvedType.noteTypeId}" — error`,
    );
    return { outcome: "error", messages };
  }

  if (regions.hasPlainSplit && regions.fieldBlocks.length === 0) {
    pushMessage(
      messages,
      "error",
      "CUS-04",
      `Card "${title}": custom note type requires ::: Field blocks, not plain ::: — skipped`,
    );
    return { outcome: "skip", messages };
  }

  if (regions.fieldBlocks.length === 0) {
    pushMessage(
      messages,
      "error",
      "CUS-01",
      `Card "${title}": custom note type "${resolvedType.noteTypeId}" missing field blocks — skipped`,
    );
    return { outcome: "skip", messages };
  }

  const knownFields = new Map(
    resolvedType.fieldNames.map((name) => [name.toLowerCase(), name]),
  );

  for (const block of regions.fieldBlocks) {
    if (resolvedType.fieldNames.length === 0) {
      break;
    }

    if (!knownFields.has(block.fieldName.toLowerCase())) {
      pushMessage(
        messages,
        "error",
        "CUS-02",
        `Card "${title}": unknown field "${block.fieldName}"; note type "${resolvedType.noteTypeId}" has: ${resolvedType.fieldNames.join(", ")}`,
      );
      return { outcome: "error", messages };
    }
  }

  return { outcome: "sync", messages };
}

export function validateCardLayout(
  resolvedType: ResolvedCardType,
  regions: CardLayoutRegions,
  options: LayoutValidatorOptions = {},
): LayoutValidationResult {
  const messages: LayoutMessage[] = [];
  const title = cardLabel(regions, options);

  if (
    regions.fieldBlocks.length > 0 &&
    resolvedType.kind !== "custom" &&
    !options.customNoteTypeDefaultAvailable
  ) {
    pushMessage(
      messages,
      "error",
      "CUS-03",
      `Card "${title}": custom field layout but no note type resolved — skipped`,
    );
    return { outcome: "skip", messages };
  }

  if (resolvedType.kind === "custom") {
    return validateCustomLayout(resolvedType, regions, options, messages);
  }

  switch (resolvedType.type) {
    case "basic":
      return validateBasicLayout(resolvedType, regions, options, messages);
    case "cloze":
      return validateClozeLayout(resolvedType, regions, options, messages);
    case "reversible":
      return validateReversibleLayout(regions, options, messages);
    case "typed":
      return validateTypedLayout(regions, options, messages);
    default:
      return { outcome: "sync", messages };
  }
}
