/** Shared types for card-syntax v1 (Card-Syntax-Spec Section 0). */

export const BUILT_IN_CARD_TYPES = [
  "basic",
  "cloze",
  "reversible",
  "typed",
] as const;

export type BuiltInCardType = (typeof BUILT_IN_CARD_TYPES)[number];

export type SyncOutcome = "sync" | "skip" | "error" | "warn";

export type DelimiterKind = ":::" | ":::r" | ":::t" | "field";

export interface SourceRange {
  start: number;
  end: number;
  startLine?: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
}

export interface FieldRegion {
  name: string;
  range: SourceRange;
}

export interface DelimiterRegion {
  kind: DelimiterKind;
  range: SourceRange;
  fieldName?: string;
}

export interface CardRegions {
  text?: SourceRange;
  back?: SourceRange;
  fields?: FieldRegion[];
  delimiters: DelimiterRegion[];
}

export type ResolvedCardType =
  | { kind: "builtin"; type: BuiltInCardType }
  | { kind: "custom"; noteTypeId: string };

export interface CardHashtags {
  user: string[];
  engine: string[];
}

export interface CardMessage {
  level: "warn" | "error" | "info" | "skip";
  text: string;
  ruleId?: string;
}

export interface ResolvedCard {
  title: string;
  ordinal: number;
  range: SourceRange;
  resolvedType: ResolvedCardType;
  resolvedFrom: string;
  outcome: SyncOutcome;
  messages: CardMessage[];
  regions: CardRegions;
  hashtags: CardHashtags;
  ankiTagPath?: string;
  ankiId?: string;
}

export interface FileDefaults {
  builtInDefault?: BuiltInCardType;
  customModelDefault?: string;
}

export interface ParseCardDocumentOptions {
  inferClozeFromManualSyntaxOnBasic: boolean;
  cardDeclarationHeadingLevel: number;
  delimiter: string;
  includeParentHeadersAsTags: boolean;
  bodyStartOffset: number;
}

export const DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS: ParseCardDocumentOptions = {
  inferClozeFromManualSyntaxOnBasic: false,
  cardDeclarationHeadingLevel: 4,
  delimiter: ":::",
  includeParentHeadersAsTags: true,
  bodyStartOffset: 0,
};

export interface ParseCardDocumentResult {
  syncEligible: boolean;
  fileDefaults: FileDefaults;
  cards: ResolvedCard[];
  messages: CardMessage[];
}

export function isBuiltInCardType(
  value: string,
): value is BuiltInCardType {
  return (BUILT_IN_CARD_TYPES as readonly string[]).includes(value);
}

export function builtinCardType(type: BuiltInCardType): ResolvedCardType {
  return { kind: "builtin", type };
}

export function customCardType(noteTypeId: string): ResolvedCardType {
  return { kind: "custom", noteTypeId };
}

export function isCustomCardType(
  type: ResolvedCardType,
): type is { kind: "custom"; noteTypeId: string } {
  return type.kind === "custom";
}

export function formatResolvedCardType(type: ResolvedCardType): string {
  if (type.kind === "builtin") {
    return type.type;
  }
  return type.noteTypeId;
}

export function formatResolvedFrom(resolvedFrom: string): string {
  return resolvedFrom;
}

export function createSourceRange(
  start: number,
  end: number,
  lines?: Pick<
    SourceRange,
    "startLine" | "endLine" | "startColumn" | "endColumn"
  >,
): SourceRange {
  return { start, end, ...lines };
}

export function createEmptyCardRegions(): CardRegions {
  return { delimiters: [] };
}

const OUTCOME_RANK: Record<SyncOutcome, number> = {
  sync: 0,
  warn: 1,
  skip: 2,
  error: 3,
};

export function mergeSyncOutcomes(
  a: SyncOutcome,
  b: SyncOutcome,
): SyncOutcome {
  return OUTCOME_RANK[a] >= OUTCOME_RANK[b] ? a : b;
}

export function isEngineHashtag(tag: string): boolean {
  const normalized = tag.startsWith("#") ? tag : `#${tag}`;
  return (
    normalized.startsWith("#anki/") || normalized.startsWith("#anki_card_")
  );
}
