import { normalizeCodeBlockLineEndings } from "./htmlNormalize";
import { stripHtmlForSearch } from "./frontSearch";

export function normalizeSyncFieldHtml(html: string): string {
  return normalizeCodeBlockLineEndings(html);
}

export function buildFrontSearchPlainText(html: string): string {
  return stripHtmlForSearch(normalizeSyncFieldHtml(html)).trim();
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

export function buildMediaFrontSearchToken(html: string): string | undefined {
  const tokens = extractMediaSrcTokens(normalizeSyncFieldHtml(html));
  return tokens[0];
}
