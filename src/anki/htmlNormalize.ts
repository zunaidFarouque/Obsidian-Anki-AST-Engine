const CODE_BLOCK_PATTERN =
  /(<pre><code\b[^>]*>)([\s\S]*?)(<\/code><\/pre>)/gi;

function normalizeCodeContent(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function normalizeCodeBlockLineEndings(html: string): string {
  return html.replace(
    CODE_BLOCK_PATTERN,
    (_match, open: string, content: string, close: string) =>
      `${open}${normalizeCodeContent(content)}${close}`,
  );
}
