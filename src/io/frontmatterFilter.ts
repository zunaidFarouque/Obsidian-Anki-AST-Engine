import { normalizeAnkiTagList } from "../anki/tagNormalize";

export type Frontmatter = Record<string, string>;

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

const ENABLED_VALUES = new Set(["on", "true", "yes"]);
const DISABLED_VALUES = new Set(["off", "false", "no"]);

export function parseFrontmatter(rawText: string): Frontmatter | null {
  const match = rawText.match(FRONTMATTER_REGEX);
  if (!match?.[1]) {
    return null;
  }

  const fields: Frontmatter = {};

  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    if (key.length > 0) {
      fields[key] = value;
    }
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

export function parseBooleanFrontmatterValue(value: string): boolean | null {
  const normalized = unquoteYamlValue(value.trim()).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (ENABLED_VALUES.has(normalized)) {
    return true;
  }

  if (DISABLED_VALUES.has(normalized)) {
    return false;
  }

  return null;
}

export function shouldSync(frontmatter: Frontmatter): boolean {
  const raw = getFrontmatterField(frontmatter, "ankisync");
  if (raw === undefined) {
    return false;
  }

  return parseBooleanFrontmatterValue(raw) === true;
}

export function shouldSyncFile(rawText: string): boolean {
  const frontmatter = parseFrontmatter(rawText);
  if (!frontmatter) {
    return false;
  }

  return shouldSync(frontmatter);
}

export function stripFrontmatter(rawText: string): string {
  const match = rawText.match(FRONTMATTER_REGEX);
  if (!match) {
    return rawText;
  }

  return rawText.slice(match[0].length).replace(/^\s+/, "");
}

export function getBodyStartOffset(rawText: string): number {
  return rawText.length - stripFrontmatter(rawText).length;
}

export function getCardDeclarationHeadingLevel(
  rawText: string,
  fallback = 4,
): number {
  return getCardDeclarationHeadingLevelFromFrontmatter(
    parseFrontmatter(rawText),
    fallback,
  );
}

export function getCardDeclarationHeadingLevelFromFrontmatter(
  frontmatter: Frontmatter | null,
  fallback = 4,
): number {
  const rawValue = frontmatter
    ? getFrontmatterField(frontmatter, "carddeclarationheadinglevel")
    : undefined;
  if (rawValue === undefined) {
    return fallback;
  }

  const level = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    return fallback;
  }

  return level;
}

export function getDelimiter(rawText: string, fallback = ":::"): string {
  return getDelimiterFromFrontmatter(parseFrontmatter(rawText), fallback);
}

export function getDelimiterFromFrontmatter(
  frontmatter: Frontmatter | null,
  fallback = ":::",
): string {
  const rawValue = frontmatter
    ? getFrontmatterField(frontmatter, "delimiter")?.trim()
    : undefined;
  if (!rawValue) {
    return fallback;
  }

  return unquoteYamlValue(rawValue);
}

export function getIncludeParentHeadersAsTags(
  rawText: string,
  fallback = true,
): boolean {
  return getIncludeParentHeadersAsTagsFromFrontmatter(
    parseFrontmatter(rawText),
    fallback,
  );
}

export function getIncludeParentHeadersAsTagsFromFrontmatter(
  frontmatter: Frontmatter | null,
  fallback = true,
): boolean {
  const rawValue = frontmatter
    ? getFrontmatterField(frontmatter, "includeparentheadersastags")
    : undefined;
  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = parseBooleanFrontmatterValue(rawValue);
  if (parsed === null) {
    return fallback;
  }

  return parsed;
}

export function getTargetAnkiDeck(rawText: string, fallback: string): string {
  const frontmatter = parseFrontmatter(rawText);
  const rawValue = getFrontmatterField(frontmatter ?? {}, "target_anki_deck");
  if (rawValue === undefined) {
    return fallback;
  }

  const deck = unquoteYamlValue(rawValue.trim());
  return deck.length > 0 ? deck : fallback;
}

export function getFileAnkiTags(rawText: string): string[] {
  const frontmatter = parseFrontmatter(rawText);
  const rawValue = getFrontmatterField(frontmatter ?? {}, "file_anki_tags");
  if (rawValue === undefined) {
    return [];
  }

  return normalizeAnkiTagList(
    unquoteYamlValue(rawValue)
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
  );
}

function getFrontmatterField(
  frontmatter: Frontmatter,
  keyLower: string,
): string | undefined {
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key.toLowerCase() === keyLower) {
      return value;
    }
  }

  return undefined;
}

function unquoteYamlValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
