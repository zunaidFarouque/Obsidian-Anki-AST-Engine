import type { AnkiConnectClient, NoteInfo } from "./client";
import { normalizeCodeBlockLineEndings } from "./htmlNormalize";

const MAX_FRONT_SEARCH_CHARS = 80;
const SEARCH_STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "any",
  "are",
  "because",
  "been",
  "but",
  "can",
  "could",
  "did",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "here",
  "how",
  "into",
  "its",
  "just",
  "not",
  "off",
  "our",
  "out",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "today",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "will",
  "with",
  "you",
  "your",
]);

export function stripHtmlForSearch(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeAnkiQuotedText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function normalizeComparableFrontHtml(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<\s*(\/?)\s*i\b/gi, "<$1em")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSyncFieldHtml(html: string): string {
  return normalizeCodeBlockLineEndings(html);
}

export function buildFrontSearchPlainText(html: string): string {
  return stripHtmlForSearch(
    normalizeComparableFrontHtml(normalizeSyncFieldHtml(html)),
  ).trim();
}

function plainTextsMatchForRecovery(left: string, right: string): boolean {
  if (left.length === 0 || right.length === 0) {
    return false;
  }

  if (left === right) {
    return true;
  }

  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}

function extractMediaSrcTokens(html: string): string[] {
  const tokens: string[] = [];
  const pattern = /\bsrc="([^"]+)"/gi;
  let match = pattern.exec(html);
  while (match) {
    tokens.push(match[1]!);
    match = pattern.exec(html);
  }
  return [...new Set(tokens)].sort();
}

export function buildMediaFrontSearchToken(html: string): string | undefined {
  const tokens = extractMediaSrcTokens(normalizeSyncFieldHtml(html));
  return tokens[0];
}

export function frontsMatchForRecovery(
  ankiFront: string,
  compiledFront: string,
): boolean {
  const normAnki = normalizeComparableFrontHtml(
    normalizeSyncFieldHtml(ankiFront),
  );
  const normCompiled = normalizeComparableFrontHtml(
    normalizeSyncFieldHtml(compiledFront),
  );
  if (normAnki === normCompiled) {
    return true;
  }

  const plainAnki = buildFrontSearchPlainText(ankiFront);
  const plainCompiled = buildFrontSearchPlainText(compiledFront);
  if (plainTextsMatchForRecovery(plainAnki, plainCompiled)) {
    return true;
  }

  const ankiMedia = extractMediaSrcTokens(normAnki);
  const compiledMedia = extractMediaSrcTokens(normCompiled);
  if (
    ankiMedia.length > 0 &&
    ankiMedia.length === compiledMedia.length &&
    ankiMedia.every((token, index) => token === compiledMedia[index])
  ) {
    return true;
  }

  return false;
}

function buildFrontSearchPlainVariants(frontHtml: string): string[] {
  const plain = buildFrontSearchPlainText(frontHtml);
  if (plain.length === 0) {
    const mediaToken = buildMediaFrontSearchToken(frontHtml);
    return mediaToken ? [mediaToken] : [];
  }

  const variants = new Set<string>();
  variants.add(plain.slice(0, MAX_FRONT_SEARCH_CHARS));
  variants.add(plain.toLocaleLowerCase().slice(0, MAX_FRONT_SEARCH_CHARS));

  if (plain.length > MAX_FRONT_SEARCH_CHARS) {
    const midpoint = Math.max(0, Math.floor(plain.length / 2) - 40);
    variants.add(plain.slice(midpoint, midpoint + MAX_FRONT_SEARCH_CHARS));
  }

  return [...variants].filter((value) => value.length > 0);
}

function buildDeckFrontSearchQuery(deck: string, frontPlain: string): string {
  return `deck:"${escapeAnkiQuotedText(deck)}" front:"${escapeAnkiQuotedText(frontPlain)}"`;
}

export function buildKeywordSearchQueries(
  deck: string,
  frontHtml: string,
): string[] {
  const plain = buildFrontSearchPlainText(frontHtml).toLocaleLowerCase();
  const words = plain
    .split(/[^a-z0-9]+/i)
    .filter(
      (word) =>
        word.length >= 4 &&
        !SEARCH_STOPWORDS.has(word) &&
        !/^\d+$/.test(word),
    );
  const unique = [...new Set(words)].sort((left, right) => right.length - left.length);
  if (unique.length < 2) {
    return [];
  }

  const keywords = unique
    .slice(0, 4)
    .map((word) => `"${escapeAnkiQuotedText(word)}"`);
  return [`deck:"${escapeAnkiQuotedText(deck)}" ${keywords.join(" ")}`];
}

export function buildFrontSearchQueries(
  deck: string | undefined,
  frontHtml: string,
): string[] {
  const queries: string[] = [];
  const plainVariants = buildFrontSearchPlainVariants(frontHtml);

  for (const plain of plainVariants) {
    if (deck) {
      queries.push(buildDeckFrontSearchQuery(deck, plain));
    }
    queries.push(`front:"${escapeAnkiQuotedText(plain)}"`);
  }

  const mediaToken = buildMediaFrontSearchToken(frontHtml);
  if (mediaToken) {
    if (deck) {
      queries.push(buildDeckFrontSearchQuery(deck, mediaToken));
    }
    queries.push(`front:"${escapeAnkiQuotedText(mediaToken)}"`);
  } else if (deck) {
    queries.push(...buildKeywordSearchQueries(deck, frontHtml));
  }

  if (deck && plainVariants.length === 0 && !mediaToken) {
    queries.push(`deck:"${escapeAnkiQuotedText(deck)}"`);
  }

  return [...new Set(queries)];
}

export function buildFrontOnlySearchQuery(frontHtml: string): string | undefined {
  return buildFrontSearchQueries(undefined, frontHtml)[0];
}

export function buildFrontDuplicateSearchQuery(
  deck: string,
  frontHtml: string,
): string {
  return (
    buildFrontSearchQueries(deck, frontHtml)[0] ??
    `deck:"${escapeAnkiQuotedText(deck)}"`
  );
}

function pickSingleFrontMatch(
  notes: NoteInfo[],
  frontHtml: string,
  deck: string,
): NoteInfo | undefined {
  const matches = notes.filter((note) =>
    frontsMatchForRecovery(note.fields.Front?.value ?? "", frontHtml),
  );

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new Error(
      `Multiple Anki notes in deck "${deck}" with matching Front field`,
    );
  }

  return undefined;
}

async function findNotesAndPickMatch(
  client: AnkiConnectClient,
  query: string,
  frontHtml: string,
  deck: string,
): Promise<NoteInfo | undefined> {
  const noteIds = await client.findNotes(query);
  if (noteIds.length === 0) {
    return undefined;
  }

  const notes = await client.notesInfo(noteIds);
  return pickSingleFrontMatch(notes, frontHtml, deck);
}

export async function findNoteByFrontInDeck(
  client: AnkiConnectClient,
  deck: string,
  frontHtml: string,
  cache?: Map<string, NoteInfo | undefined>,
): Promise<NoteInfo | undefined> {
  const cacheKey = `${deck}\0${normalizeSyncFieldHtml(frontHtml)}`;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  for (const query of buildFrontSearchQueries(deck, frontHtml)) {
    const match = await findNotesAndPickMatch(
      client,
      query,
      frontHtml,
      deck,
    );
    if (match) {
      cache?.set(cacheKey, match);
      return match;
    }
  }

  return undefined;
}
