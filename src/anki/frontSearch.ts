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

export function buildFrontDuplicateSearchQuery(
  deck: string,
  frontHtml: string,
): string {
  const escapedDeck = escapeAnkiQuotedText(deck);
  const plain = stripHtmlForSearch(frontHtml).slice(0, MAX_FRONT_SEARCH_CHARS);

  if (plain.length === 0) {
    return `deck:"${escapedDeck}"`;
  }

  const escapedFront = escapeAnkiQuotedText(plain);
  return `deck:"${escapedDeck}" front:"${escapedFront}"`;
}
