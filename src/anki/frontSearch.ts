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

export function escapeAnkiSearchText(value: string): string {
  return escapeAnkiQuotedText(value);
}

export function buildFrontOnlySearchQuery(frontHtml: string): string | undefined {
  const plain = buildFrontSearchPlainText(frontHtml).slice(
    0,
    MAX_FRONT_SEARCH_CHARS,
  );
  if (plain.length === 0) {
    return undefined;
  }
  return `front:"${escapeAnkiQuotedText(plain)}"`;
}

export function buildFrontDuplicateSearchQuery(
  deck: string,
  frontHtml: string,
): string {
  const escapedDeck = escapeAnkiQuotedText(deck);
  const plain = buildFrontSearchPlainText(frontHtml).slice(
    0,
    MAX_FRONT_SEARCH_CHARS,
  );

  if (plain.length > 0) {
    return `deck:"${escapedDeck}" front:"${escapeAnkiQuotedText(plain)}"`;
  }

  const mediaToken = buildMediaFrontSearchToken(frontHtml);
  if (mediaToken) {
    return `deck:"${escapedDeck}" front:"${escapeAnkiQuotedText(mediaToken)}"`;
  }

  return `deck:"${escapedDeck}"`;
}

export function buildFrontSearchPlainText(html: string): string {
  return stripHtmlForSearch(normalizeSyncFieldHtml(html)).trim();
}

export function normalizeSyncFieldHtml(html: string): string {
  return normalizeCodeBlockLineEndings(html);
}

export function buildMediaFrontSearchToken(html: string): string | undefined {
  const tokens = extractMediaSrcTokens(normalizeSyncFieldHtml(html));
  return tokens[0];
}

import { normalizeCodeBlockLineEndings } from "./htmlNormalize";

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
  if (plainAnki.length > 0 && plainAnki === plainCompiled) {
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

function pickSingleFrontMatch(
  notes: Array<{ noteId: number; fields: Record<string, { value: string }> }>,
  frontHtml: string,
  deck: string,
): (typeof notes)[number] | undefined {
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
