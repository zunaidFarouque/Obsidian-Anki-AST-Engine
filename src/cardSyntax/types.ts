/** Shared types for card-syntax v1 (Card-Syntax-Spec Section 0). */
import type { RootContent, Root } from "mdast";

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
  tag: string;
  frontNodes: RootContent[];
  backNodes: RootContent[];
  sectionDepths: Map<number, string>;
  injectionOffset?: number;
  clozeTokens?: import("./clozeProcessor").ProcessedClozeToken[];
  customFields?: Array<{ name: string; nodes: RootContent[] }>;
}

export type CustomLayoutFieldMapping =
  | [string, string]
  | { front: string; back: string };

export type CustomLayoutMap = Record<string, CustomLayoutFieldMapping>;

export interface FileDefaults {
  builtInDefault?: BuiltInCardType;
  customNoteTypeDefault?: string;
  customLayoutMap?: CustomLayoutMap;
}

export interface ParseCardDocumentOptions {
  cardDeclarationHeadingLevel: number;
  delimiter: string;
  bodyStartOffset: number;
  includeParentHeadersAsTags: boolean;
  inferClozeFromManualSyntaxOnBasic: boolean;
  noteTypeFieldNamesByNoteType: Record<string, string[]>;
  /** Obsidian Properties / metadata when the editor body omits the YAML block. */
  externalFrontmatter?: import("../io/frontmatterFilter").Frontmatter | null;
  ast?: Root;
  customLayoutMap?: CustomLayoutMap;
}

export const DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS: ParseCardDocumentOptions = {
  inferClozeFromManualSyntaxOnBasic: false,
  cardDeclarationHeadingLevel: 4,
  delimiter: ":::",
  includeParentHeadersAsTags: true,
  bodyStartOffset: 0,
  noteTypeFieldNamesByNoteType: {},
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

export function resolveCustomLayoutMapping(
  map: CustomLayoutMap | undefined,
  noteTypeId: string,
): { front: string; back: string } | undefined {
  if (!map || !noteTypeId) {
    return undefined;
  }

  let entry: CustomLayoutFieldMapping | undefined = map[noteTypeId];
  if (!entry) {
    const targetLower = noteTypeId.toLowerCase();
    for (const [key, val] of Object.entries(map)) {
      if (key.toLowerCase() === targetLower) {
        entry = val;
        break;
      }
    }
  }

  if (!entry && map["*"]) {
    entry = map["*"];
  }

  if (!entry) {
    return undefined;
  }

  if (Array.isArray(entry)) {
    if (entry.length >= 2) {
      const front = String(entry[0]).trim();
      const back = String(entry[1]).trim();
      if (front.length > 0 && back.length > 0) {
        return { front, back };
      }
    }
    return undefined;
  }

  if (typeof entry === "object" && entry !== null) {
    const front = typeof entry.front === "string" ? entry.front.trim() : "";
    const back = typeof entry.back === "string" ? entry.back.trim() : "";
    if (front.length > 0 && back.length > 0) {
      return { front, back };
    }
  }

  return undefined;
}

