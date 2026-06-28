import type { AnkiConnectClient, NoteInfo } from "./client";
import { normalizeCodeBlockLineEndings } from "./htmlNormalize";

const MAX_FRONT_SEARCH_CHARS = 80;

export function stripHtmlForSearch(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeAnkiQuotedText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function normalizeSyncFieldHtml(html: string): string {
  return normalizeCodeBlockLineEndings(html);
}

export function buildFrontSearchPlainText(html: string): string {
  return stripHtmlForSearch(normalizeSyncFieldHtml(html)).trim();
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
  const normAnki = normalizeSyncFieldHtml(ankiFront);
  const normCompiled = normalizeSyncFieldHtml(compiledFront);
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

export function buildFrontOnlySearchQuery(frontHtml: string): string | undefined {
  return buildFrontSearchQueries(undefined, frontHtml)[0];
}

function buildDeckFrontSearchQuery(deck: string, frontPlain: string): string {
  return `deck:"${escapeAnkiQuotedText(deck)}" front:"${escapeAnkiQuotedText(frontPlain)}"`;
}

function buildFrontSearchPlainVariants(frontHtml: string): string[] {
  const plain = buildFrontSearchPlainText(frontHtml).slice(
    0,
    MAX_FRONT_SEARCH_CHARS,
  );
  if (plain.length === 0) {
    const mediaToken = buildMediaFrontSearchToken(frontHtml);
    return mediaToken ? [mediaToken] : [];
  }

  return [...new Set([plain, plain.toLocaleLowerCase()])];
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
  } else if (deck && plainVariants.length === 0) {
    queries.push(`deck:"${escapeAnkiQuotedText(deck)}"`);
  }

  return [...new Set(queries)];
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

  cache?.set(cacheKey, undefined);
  return undefined;
}
