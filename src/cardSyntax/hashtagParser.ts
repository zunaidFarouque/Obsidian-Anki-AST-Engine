/**
 * Hashtag parsing for card-syntax v1 (Section 3 — TAG-01..04).
 *
 * NOTE for Agent 1: `types.ts` is not present yet. These types should move to
 * `src/cardSyntax/types.ts` when that module is created.
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
  model?: string;
  errors: HashtagParseError[];
}

const HASHTAG_PATTERN = /#([^\s#,;!.?()[\]{}]+)/g;

type DirectiveKind = "cardType" | "model";

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
    return "user";
  }

  if (tag.startsWith("anki/model/")) {
    const modelId = tag.slice("anki/model/".length);
    if (modelId.length > 0) {
      return { kind: "model", value: modelId, raw: tag };
    }
    return "user";
  }

  if (tag.startsWith("anki/")) {
    const modelPath = tag.slice("anki/".length);
    if (modelPath.length > 0) {
      return { kind: "model", value: modelPath, raw: tag };
    }
    return "user";
  }

  if (tag.startsWith("anki_card_")) {
    const modelId = tag.slice("anki_card_".length);
    if (modelId.length > 0) {
      return { kind: "model", value: modelId, raw: tag };
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
  const modelTags: string[] = [];

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

    modelTags.push(classified.value);
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
  const hasModel = modelTags.length > 0;

  if (hasCardType && hasModel) {
    errors.push({
      ruleId: "TAG-02",
      message:
        "A heading cannot carry both #anki/cardType/* and a model declaration (#anki/model/* or legacy model tags)",
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

  if (modelTags.length === 1) {
    result.model = modelTags[0];
  }

  return result;
}
