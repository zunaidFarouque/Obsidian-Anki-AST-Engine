import {
  parseFrontmatter,
  type Frontmatter,
} from "../io/frontmatterFilter";

export const BUILT_IN_CARD_TYPES = [
  "basic",
  "cloze",
  "reversible",
  "typed",
] as const;

export type BuiltInCardType = (typeof BUILT_IN_CARD_TYPES)[number];

const BUILT_IN_CARD_TYPE_SET = new Set<string>(BUILT_IN_CARD_TYPES);

export type FileDefaults = {
  builtIn: BuiltInCardType | null;
  custom: string | null;
};

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

export function parseBuiltInCardDefault(value: string): BuiltInCardType | null {
  const normalized = unquoteYamlValue(value.trim()).toLowerCase();
  if (!normalized || !BUILT_IN_CARD_TYPE_SET.has(normalized)) {
    return null;
  }

  return normalized as BuiltInCardType;
}

export function parseCustomCardDefault(value: string): string | null {
  const noteTypeId = unquoteYamlValue(value.trim());
  return noteTypeId.length > 0 ? noteTypeId : null;
}

export function parseAnkiCardDefaultFromFrontmatter(
  frontmatter: Frontmatter,
): BuiltInCardType | null {
  const raw = getFrontmatterField(frontmatter, "anki_carddefault");
  if (raw === undefined) {
    return null;
  }

  return parseBuiltInCardDefault(raw);
}

export function parseAnkiCustomCardDefaultFromFrontmatter(
  frontmatter: Frontmatter,
): string | null {
  const raw = getFrontmatterField(frontmatter, "anki_customcarddefault");
  if (raw === undefined) {
    return null;
  }

  return parseCustomCardDefault(raw);
}

export function resolveFileDefaults(frontmatter: Frontmatter | null): FileDefaults {
  if (!frontmatter) {
    return { builtIn: null, custom: null };
  }

  return {
    builtIn: parseAnkiCardDefaultFromFrontmatter(frontmatter),
    custom: parseAnkiCustomCardDefaultFromFrontmatter(frontmatter),
  };
}

export function resolveFileDefaultsFromRaw(rawText: string): FileDefaults {
  return resolveFileDefaults(parseFrontmatter(rawText));
}

/**
 * FM-04 — File defaults vs ancestor headings.
 * Ancestor heading type declarations override file frontmatter defaults.
 * File defaults apply only when steps 1–2 of resolution find nothing.
 */
export function effectiveBuiltInDefaultFm04(
  ancestorBuiltIn: BuiltInCardType | null,
  fileDefaults: FileDefaults,
): BuiltInCardType | null {
  if (ancestorBuiltIn !== null) {
    return ancestorBuiltIn;
  }

  return fileDefaults.builtIn;
}

/**
 * FM-04 + RES-04 — ancestor note type beats file custom default;
 * custom default applies only with `::: FieldName` blocks and no inherited note type.
 */
export function effectiveCustomNoteTypeFm04(
  ancestorOrCardNoteType: string | null,
  hasFieldBlocks: boolean,
  fileDefaults: FileDefaults,
): string | null {
  if (ancestorOrCardNoteType !== null) {
    return ancestorOrCardNoteType;
  }

  return customDefaultAppliesRes04(
    hasFieldBlocks,
    false,
    fileDefaults,
  );
}

/** RES-04 — custom default is layout-triggered. */
export function customDefaultAppliesRes04(
  hasFieldBlocks: boolean,
  noteTypeResolvedFromInheritance: boolean,
  fileDefaults: FileDefaults,
): string | null {
  if (
    noteTypeResolvedFromInheritance ||
    !hasFieldBlocks ||
    fileDefaults.custom === null
  ) {
    return null;
  }

  return fileDefaults.custom;
}
