/**
 * Hashtag parsing for card-syntax v1 (Section 3 — TAG-01..04).
 */

export type BuiltinCardType = "basic" | "cloze" | "reversible" | "typed";

const BUILTIN_CARD_TYPES = new Set<BuiltinCardType>([
  "basic",
  "cloze",
  "reversible",
  "typed",
]);

export type HashtagRuleId = "TAG-01" | "TAG-02";

export interface HashtagParseError {
  ruleId: HashtagRuleId;
  message: string;
}

export interface HashtagParseResult {
  userTags: string[];
  cardType?: BuiltinCardType;
  noteTypeId?: string;
  errors: HashtagParseError[];
}

const HASHTAG_PATTERN = /#([^\s#,;!.?()[\]{}]+)/g;

type DirectiveKind = "cardType" | "noteType";

interface ParsedDirective {
  kind: DirectiveKind;
  value: string;
  raw: string;
}

function extractHashtags(text: string): string[] {
  const tags: string[] = [];
  const pattern = new RegExp(HASHTAG_PATTERN.source, HASHTAG_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    tags.push(match[1]!);
  }

  return tags;
}

function parseNoteTypeSuffix(tag: string, prefix: string): ParsedDirective | "user" {
  const noteTypeId = tag.slice(prefix.length);
  if (noteTypeId.length > 0) {
    return { kind: "noteType", value: noteTypeId, raw: tag };
  }
  return "user";
}

function classifyHashtag(tag: string): ParsedDirective | "user" {
  if (tag.startsWith("anki/cardType/")) {
    const typeName = tag.slice("anki/cardType/".length);
    if (BUILTIN_CARD_TYPES.has(typeName as BuiltinCardType)) {
      return {
        kind: "cardType",
        value: typeName,
        raw: tag,
      };
    }
    return {
      kind: "cardType",
      value: typeName,
      raw: tag,
    };
  }

  if (tag.startsWith("anki/noteType/")) {
    return parseNoteTypeSuffix(tag, "anki/noteType/");
  }

  if (tag.startsWith("anki/")) {
    const noteTypePath = tag.slice("anki/".length);
    if (noteTypePath.length > 0 && !noteTypePath.startsWith("cardType/")) {
      return { kind: "noteType", value: noteTypePath, raw: tag };
    }
    return "user";
  }

  if (tag.startsWith("anki_card_")) {
    const noteTypeId = tag.slice("anki_card_".length);
    if (noteTypeId.length > 0) {
      return { kind: "noteType", value: noteTypeId, raw: tag };
    }
    return "user";
  }

  return "user";
}

function isValidCardType(value: string): value is BuiltinCardType {
  return BUILTIN_CARD_TYPES.has(value as BuiltinCardType);
}

export function parseHeadingHashtags(text: string): HashtagParseResult {
  const rawTags = extractHashtags(text);
  const userTags: string[] = [];
  const cardTypeTags: string[] = [];
  const noteTypeTags: string[] = [];

  for (const tag of rawTags) {
    const classified = classifyHashtag(tag);
    if (classified === "user") {
      userTags.push(tag);
      continue;
    }

    if (classified.kind === "cardType") {
      cardTypeTags.push(classified.value);
      continue;
    }

    noteTypeTags.push(classified.value);
  }

  const errors: HashtagParseError[] = [];

  if (cardTypeTags.length > 1) {
    errors.push({
      ruleId: "TAG-01",
      message:
        "At most one #anki/cardType/* tag per heading; found multiple cardType declarations",
    });
  }

  const hasCardType = cardTypeTags.length > 0;
  const hasNoteType = noteTypeTags.length > 0;

  if (hasCardType && hasNoteType) {
    errors.push({
      ruleId: "TAG-02",
      message:
        "A heading cannot carry both #anki/cardType/* and #anki/noteType/* (or #anki_card_* / #anki/... note type tags)",
    });
  }

  if (errors.length > 0) {
    return { userTags, errors };
  }

  const result: HashtagParseResult = { userTags, errors };

  if (cardTypeTags.length === 1) {
    const typeName = cardTypeTags[0]!;
    if (isValidCardType(typeName)) {
      result.cardType = typeName;
    }
  }

  if (noteTypeTags.length === 1) {
    result.noteTypeId = noteTypeTags[0];
  }

  return result;
}
