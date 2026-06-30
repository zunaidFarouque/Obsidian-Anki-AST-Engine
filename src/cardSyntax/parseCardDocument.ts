import type { Content, Heading, Root } from "mdast";
import { parseMarkdown } from "../ast/processor";
import { parseFrontmatter, shouldSyncFile } from "../io/frontmatterFilter";
import { nodesToPreview, nodesToRawText } from "../utils/textPreview";
import { processClozeDeletions } from "./clozeProcessor";
import { crossCuttingMessages } from "./crossCuttingRules";
import { resolveFileDefaultsFromRaw } from "./frontmatterDefaults";
import { parseHeadingHashtags, type HashtagParseResult } from "./hashtagParser";
import {
  validateCardLayout,
  type CardFieldBlock,
  type CardLayoutRegions,
  type LayoutMessage,
  type ResolvedCardType as LayoutResolvedCardType,
} from "./layoutValidator";
import {
  buildOutlineFromAst,
  getAncestorHeadings,
  type OutlineHeading,
} from "./outlineTree";
import { extractCardRegions } from "./regionExtractor";
import { resolveCardType, type HeadingTypeDeclaration } from "./typeResolver";
import {
  createSourceRange,
  customCardType,
  mergeSyncOutcomes,
  DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
  type CardMessage,
  type FileDefaults,
  type ParseCardDocumentOptions,
  type ParseCardDocumentResult,
  type ResolvedCard,
  type ResolvedCardType,
  type SyncOutcome,
} from "./types";

const ANKI_ID_REGEX =
  /<!--\s*anki-id:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*-->/i;

const HASHTAG_STRIP_PATTERN = /#[^\s#,;!.?()[\]{}]+/g;

const MODEL_FIELD_NAMES: Record<string, string[]> = {
  Vocab: ["Word", "Definition", "Example"],
};

export function parseCardDocument(
  rawText: string,
  options: Partial<ParseCardDocumentOptions> = {},
): ParseCardDocumentResult {
  const resolvedOptions: ParseCardDocumentOptions = {
    ...DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
    ...options,
  };

  const syncEligible = shouldSyncFile(rawText);
  const fmDefaults = resolveFileDefaultsFromRaw(rawText);
  const fileDefaults: FileDefaults = {
    builtInDefault: fmDefaults.builtIn ?? undefined,
    customModelDefault: fmDefaults.custom ?? undefined,
  };

  if (!syncEligible) {
    return {
      syncEligible: false,
      fileDefaults,
      cards: [],
      messages: [],
    };
  }

  const ast = parseMarkdown(rawText, "");
  const outline = buildOutlineFromAst(
    ast,
    resolvedOptions.cardDeclarationHeadingLevel,
  );

  const cards = outline.cardHeadings.map((cardHeading, ordinal) =>
    resolveCard(
      rawText,
      ast,
      cardHeading,
      ordinal,
      outline,
      resolvedOptions,
      fileDefaults,
    ),
  );

  return {
    syncEligible: true,
    fileDefaults,
    cards,
    messages: [],
  };
}

function resolveCard(
  rawText: string,
  ast: Root,
  cardHeading: OutlineHeading,
  ordinal: number,
  outline: ReturnType<typeof buildOutlineFromAst>,
  options: ParseCardDocumentOptions,
  fileDefaults: FileDefaults,
): ResolvedCard {
  const headingText = cardHeading.text;
  const title = stripAllHashtags(headingText);
  const cardHashtags = parseHeadingHashtags(headingText);
  const ancestors = getAncestorHeadings(cardHeading);
  const ancestorHashtagResults = ancestors.map((ancestor) =>
    parseHeadingHashtags(ancestor.text),
  );

  const bodyNodes = collectCardBodyNodes(
    ast,
    cardHeading,
    outline,
    options.bodyStartOffset,
  );
  const extracted = extractCardRegions(bodyNodes);
  const layoutRegions = buildLayoutRegions(title, extracted);

  const cardHeadingDecl = toHeadingDeclaration(
    cardHashtags,
    cardHeading.depth,
    title,
  );
  const ancestorDecls = ancestors.map((ancestor, index) =>
    toHeadingDeclaration(
      ancestorHashtagResults[index]!,
      ancestor.depth,
      stripAllHashtags(ancestor.text),
    ),
  );

  const resolved = resolveCardType({
    cardHeading: cardHeadingDecl,
    ancestors: ancestorDecls,
    textRegion: layoutRegions.textRegion,
    hasFieldBlocks: layoutRegions.fieldBlocks.length > 0,
    hasReversibleDelimiter: layoutRegions.hasReversibleDelimiter,
    hasTypedDelimiter: layoutRegions.hasTypedDelimiter,
    frontmatter: {
      anki_cardDefault: fileDefaults.builtInDefault,
      anki_customCardDefault: fileDefaults.customModelDefault,
    },
    inferClozeFromManualSyntaxOnBasic:
      options.inferClozeFromManualSyntaxOnBasic,
  });

  const messages: CardMessage[] = collectHashtagErrors(
    cardHashtags,
    ancestorHashtagResults,
  );
  let outcome: SyncOutcome = messages.some((message) => message.level === "error")
    ? "error"
    : "sync";

  const layoutType = toLayoutResolvedType(resolved);
  const layoutResult = validateCardLayout(layoutType, layoutRegions, {
    cardTitle: title,
    inferClozeFromManualSyntaxOnBasic:
      options.inferClozeFromManualSyntaxOnBasic,
    customModelAvailable: fileDefaults.customModelDefault !== undefined,
  });

  messages.push(...layoutMessagesToCardMessages(layoutResult.messages));

  if (outcome !== "error") {
    outcome = mergeSyncOutcomes(outcome, layoutResult.outcome);
  }

  const effectiveResolved = layoutResult.effectiveType
    ? toOutputResolvedType(layoutResult.effectiveType)
    : toOutputResolvedType(resolved);

  const layoutRuleIds = layoutResult.messages.map((message) => message.ruleId);
  const existingRuleIds = new Set(
    messages
      .map((message) => message.ruleId)
      .filter((ruleId): ruleId is string => ruleId !== undefined),
  );
  messages.push(
    ...crossCuttingMessages(
      {
        cardTitle: title,
        resolvedType: effectiveResolved,
        outcome:
          outcome === "error"
            ? "error"
            : layoutResult.outcome === "skip"
              ? "skip"
              : "sync",
        regions: layoutRegions,
        layoutRuleIds,
        fileBuiltInDefault: fileDefaults.builtInDefault,
        cardHeadingBuiltinType: cardHashtags.cardType,
        resolvedFrom: resolved.resolvedFrom,
        hasManualClozeInText: /\{\{c\d+::/.test(layoutRegions.textRegion),
        hasBareClozeInText: /\{\{(?!c\d+::)[^}]+\}\}/.test(
          layoutRegions.textRegion,
        ),
      },
      existingRuleIds,
    ),
  );

  if (
    effectiveResolved.kind === "builtin" &&
    effectiveResolved.type === "cloze" &&
    outcome === "sync"
  ) {
    const clozeResult = processClozeDeletions(layoutRegions.textRegion, {
      allowShorthand: true,
    });
    for (const warning of clozeResult.warnings) {
      messages.push({
        level: "warn",
        text: `Card "${title}": ${warning} — warning`,
        ruleId: "CLZ-07",
      });
    }
  }

  return {
    title,
    ordinal,
    range: cardRange(cardHeading, bodyNodes, rawText.length),
    resolvedType: effectiveResolved,
    resolvedFrom: resolved.resolvedFrom,
    outcome,
    messages,
    regions: extracted.regions,
    hashtags: collectCardHashtags(cardHashtags, ancestorHashtagResults),
    ankiTagPath: buildAnkiTagPath(
      ancestors,
      title,
      options.includeParentHeadersAsTags,
    ),
    ankiId: extractAnkiId(extracted.backNodes),
  };
}

function collectHashtagErrors(
  cardHashtags: HashtagParseResult,
  ancestorResults: HashtagParseResult[],
): CardMessage[] {
  const messages: CardMessage[] = [];

  const pushTagError = (error: { ruleId: string; message: string }, fromSection: boolean) => {
    messages.push({
      level: "error",
      text: error.message,
      ruleId: error.ruleId,
    });

    if (error.ruleId === "TAG-01") {
      messages.push({
        level: "info",
        text: `Card: CX-01 applies`,
        ruleId: "CX-01",
      });
      if (fromSection) {
        messages.push({
          level: "info",
          text: `Card: CX-26 applies`,
          ruleId: "CX-26",
        });
      }
    }

    if (error.ruleId === "TAG-02") {
      messages.push({
        level: "info",
        text: `Card: CX-02 applies`,
        ruleId: "CX-02",
      });
    }
  };

  for (const error of cardHashtags.errors) {
    pushTagError(error, false);
  }

  for (const ancestor of ancestorResults) {
    for (const error of ancestor.errors) {
      pushTagError(error, true);
    }
  }

  return messages;
}

function layoutMessagesToCardMessages(messages: LayoutMessage[]): CardMessage[] {
  return messages.map((message) => ({
    level:
      message.kind === "warn"
        ? "warn"
        : message.kind === "info"
          ? "info"
          : message.message.includes("skipped")
            ? "skip"
            : "error",
    text: message.message,
    ruleId: message.ruleId,
  }));
}

function toHeadingDeclaration(
  hashtags: HashtagParseResult,
  headingLevel: number,
  headingTitle: string,
): HeadingTypeDeclaration {
  return {
    headingLevel,
    headingTitle,
    builtinType: hashtags.cardType,
    modelId: hashtags.model,
  };
}

function stripAllHashtags(text: string): string {
  return text.replace(HASHTAG_STRIP_PATTERN, "").replace(/\s+/g, " ").trim();
}

function isWithinBody(node: Content, bodyStartOffset: number): boolean {
  const start = node.position?.start?.offset;
  if (start === undefined) {
    return true;
  }
  return start >= bodyStartOffset;
}

function collectCardBodyNodes(
  ast: Root,
  cardHeading: OutlineHeading,
  outline: ReturnType<typeof buildOutlineFromAst>,
  bodyStartOffset: number,
): Content[] {
  const declarationLevel = outline.cardDeclarationLevel;
  const cardStart = cardHeading.node.position?.start?.offset ?? 0;
  const cardEnd = findCardEndOffset(ast, cardStart, declarationLevel);

  const nodes: Content[] = [];
  for (const child of ast.children) {
    if (!isWithinBody(child, bodyStartOffset)) {
      continue;
    }

    const start = child.position?.start?.offset;
    if (start === undefined || start <= cardStart) {
      continue;
    }
    if (start >= cardEnd) {
      break;
    }

    nodes.push(child);
  }

  return nodes;
}

function findCardEndOffset(
  ast: Root,
  cardStart: number,
  declarationLevel: number,
): number {
  for (const child of ast.children) {
    if (child.type !== "heading") {
      continue;
    }

    const heading = child as Heading;
    const start = heading.position?.start?.offset;
    if (start === undefined || start <= cardStart) {
      continue;
    }

    if (heading.depth <= declarationLevel) {
      return start;
    }
  }

  return Number.POSITIVE_INFINITY;
}

function buildLayoutRegions(
  title: string,
  extracted: ReturnType<typeof extractCardRegions>,
): CardLayoutRegions {
  const delimiters = extracted.regions.delimiters;
  const fieldBlocks: CardFieldBlock[] = extracted.fields.map((field) => ({
    fieldName: field.name,
    content: nodesToPreview(field.nodes),
  }));

  return {
    cardTitle: title,
    textRegion: nodesToPreview(extracted.textNodes),
    backRegion:
      extracted.backNodes.length > 0
        ? nodesToRawText(extracted.backNodes)
        : undefined,
    hasPlainSplit: delimiters.some((delimiter) => delimiter.kind === ":::"),
    hasReversibleDelimiter: delimiters.some(
      (delimiter) => delimiter.kind === ":::r",
    ),
    hasTypedDelimiter: delimiters.some(
      (delimiter) => delimiter.kind === ":::t",
    ),
    hasEmbeddedReversibleDelimiter: extracted.hasEmbeddedReversibleDelimiter,
    hasEmbeddedTypedDelimiter: extracted.hasEmbeddedTypedDelimiter,
    fieldBlocks,
  };
}

function toLayoutResolvedType(
  resolved: ReturnType<typeof resolveCardType>,
): LayoutResolvedCardType {
  if (resolved.kind === "custom") {
    return {
      kind: "custom",
      modelId: resolved.modelId,
      fieldNames: MODEL_FIELD_NAMES[resolved.modelId] ?? [],
    };
  }

  return { kind: "builtin", type: resolved.type };
}

function toOutputResolvedType(
  type: LayoutResolvedCardType | ReturnType<typeof resolveCardType>,
): ResolvedCardType {
  if (type.kind === "custom") {
    return customCardType(type.modelId);
  }
  return { kind: "builtin", type: type.type };
}

function buildAnkiTagPath(
  ancestors: OutlineHeading[],
  cardTitle: string,
  includeParents: boolean,
): string | undefined {
  const parts: string[] = [];

  if (includeParents) {
    for (const ancestor of ancestors) {
      const stripped = stripAllHashtags(ancestor.text);
      if (stripped.length > 0) {
        parts.push(stripped);
      }
    }
  }

  if (cardTitle.length > 0) {
    parts.push(cardTitle);
  }

  return parts.length > 0 ? parts.join("::") : undefined;
}

function collectCardHashtags(
  cardHashtags: HashtagParseResult,
  ancestorResults: HashtagParseResult[],
): { user: string[]; engine: string[] } {
  const user = new Set<string>();
  const engine: string[] = [];

  for (const tags of [cardHashtags, ...ancestorResults]) {
    for (const tag of tags.userTags) {
      user.add(tag);
    }
    if (tags.cardType) {
      engine.push(`#anki/cardType/${tags.cardType}`);
    }
    if (tags.model) {
      engine.push(`#anki/model/${tags.model}`);
    }
  }

  return {
    user: [...user],
    engine,
  };
}

function cardRange(
  cardHeading: OutlineHeading,
  bodyNodes: Content[],
  fileLength: number,
): ReturnType<typeof createSourceRange> {
  const start = cardHeading.node.position?.start?.offset ?? 0;
  let end = cardHeading.node.position?.end?.offset ?? start;

  for (const node of bodyNodes) {
    const nodeEnd = node.position?.end?.offset;
    if (nodeEnd !== undefined && nodeEnd > end) {
      end = nodeEnd;
    }
  }

  if (end === start) {
    end = Math.min(fileLength, start + 1);
  }

  return createSourceRange(start, end);
}

function extractAnkiId(backNodes: Content[]): string | undefined {
  const backText = nodesToPreview(backNodes);
  const match = backText.match(ANKI_ID_REGEX);
  return match?.[1];
}
