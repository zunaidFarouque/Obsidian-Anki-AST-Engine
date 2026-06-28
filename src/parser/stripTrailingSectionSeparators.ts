import type { Content } from "mdast";

const ANKI_ID_REGEX =
  /<!--\s*anki-id:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*-->/i;

function isAnkiIdHtmlNode(node: Content): boolean {
  return (
    node.type === "html" &&
    "value" in node &&
    ANKI_ID_REGEX.test(String(node.value))
  );
}

/**
 * Removes trailing `---` / thematicBreak nodes used as section separators in
 * Obsidian before the next H1–H4 heading. Preserves trailing `<!--anki-id-->`
 * html nodes used for vault binding.
 */
export function stripTrailingSectionSeparators(nodes: Content[]): Content[] {
  const result = [...nodes];
  let index = result.length - 1;

  while (index >= 0) {
    const node = result[index];
    if (node && isAnkiIdHtmlNode(node)) {
      index -= 1;
      continue;
    }

    if (node?.type === "thematicBreak") {
      result.splice(index, 1);
      index -= 1;
      continue;
    }

    break;
  }

  return result;
}
