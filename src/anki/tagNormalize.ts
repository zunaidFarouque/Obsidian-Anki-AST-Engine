export function normalizeAnkiTagSegment(segment: string): string {
  return segment
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normalizeAnkiTagPath(tagPath: string): string {
  const trimmed = tagPath.trim();
  if (trimmed.length === 0) {
    return "";
  }

  return trimmed
    .split("::")
    .map((segment) => normalizeAnkiTagSegment(segment))
    .filter((segment) => segment.length > 0)
    .join("::");
}

export function normalizeAnkiTagList(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const value = normalizeAnkiTagPath(tag);
    if (value.length === 0 || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}
