import {
  parseFrontmatter,
  type Frontmatter,
} from "../io/frontmatterFilter";
import type { CustomLayoutMap } from "./types";

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
  customLayoutMap?: CustomLayoutMap | null;
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

export function parseCustomLayoutMap(
  value: unknown,
  customCardDefault?: string | null,
): CustomLayoutMap | null {
  if (value === null || value === undefined) {
    return null;
  }

  let parsed: unknown = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const unquoted = unquoteYamlValue(trimmed);
    try {
      parsed = JSON.parse(unquoted);
    } catch {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        const parts = unquoted.split(",").map((p) => p.trim()).filter(Boolean);
        if (parts.length === 2) {
          parsed = parts;
        } else if (parts.length === 3) {
          parsed = { [parts[0]!]: [parts[1]!, parts[2]!] };
        } else {
          return null;
        }
      }
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if (
    Array.isArray(parsed) &&
    parsed.length === 2 &&
    typeof parsed[0] === "string" &&
    typeof parsed[1] === "string"
  ) {
    const front = parsed[0].trim();
    const back = parsed[1].trim();
    if (front.length > 0 && back.length > 0) {
      const targetNoteType = customCardDefault?.trim() || "*";
      return { [targetNoteType]: [front, back] };
    }
    return null;
  }

  if (Array.isArray(parsed)) {
    const result: CustomLayoutMap = {};
    for (const item of parsed) {
      if (Array.isArray(item)) {
        if (
          item.length === 3 &&
          typeof item[0] === "string" &&
          typeof item[1] === "string" &&
          typeof item[2] === "string"
        ) {
          result[item[0].trim()] = [item[1].trim(), item[2].trim()];
        } else if (
          item.length === 2 &&
          typeof item[0] === "string" &&
          Array.isArray(item[1]) &&
          item[1].length === 2
        ) {
          result[item[0].trim()] = [
            String(item[1][0]).trim(),
            String(item[1][1]).trim(),
          ];
        }
      } else if (item && typeof item === "object") {
        const noteType = String(
          (item as any).noteType ?? (item as any).name ?? "",
        ).trim();
        const front = String((item as any).front ?? "").trim();
        const back = String((item as any).back ?? "").trim();
        if (noteType && front && back) {
          result[noteType] = { front, back };
        }
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  if (
    "front" in parsed &&
    "back" in parsed &&
    typeof (parsed as any).front === "string" &&
    typeof (parsed as any).back === "string"
  ) {
    const front = (parsed as any).front.trim();
    const back = (parsed as any).back.trim();
    if (front.length > 0 && back.length > 0) {
      const targetNoteType = customCardDefault?.trim() || "*";
      return { [targetNoteType]: { front, back } };
    }
    return null;
  }

  const result: CustomLayoutMap = {};
  for (const [key, val] of Object.entries(parsed)) {
    if (!key.trim()) continue;
    if (
      Array.isArray(val) &&
      val.length >= 2 &&
      typeof val[0] === "string" &&
      typeof val[1] === "string"
    ) {
      result[key.trim()] = [val[0].trim(), val[1].trim()];
    } else if (
      val &&
      typeof val === "object" &&
      "front" in val &&
      "back" in val
    ) {
      const front = String((val as any).front).trim();
      const back = String((val as any).back).trim();
      if (front && back) {
        result[key.trim()] = { front, back };
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function parseAnkiCustomLayoutMapFromFrontmatter(
  frontmatter: Frontmatter,
  customCardDefault?: string | null,
): CustomLayoutMap | null {
  const raw = getFrontmatterField(frontmatter, "anki_customlayoutmap");
  if (raw === undefined || raw === null) {
    return null;
  }

  return parseCustomLayoutMap(raw, customCardDefault);
}

export function resolveFileDefaults(frontmatter: Frontmatter | null): FileDefaults {
  if (!frontmatter) {
    return { builtIn: null, custom: null };
  }

  const customDefault = parseAnkiCustomCardDefaultFromFrontmatter(frontmatter);
  const customLayoutMap = parseAnkiCustomLayoutMapFromFrontmatter(
    frontmatter,
    customDefault,
  );

  const result: FileDefaults = {
    builtIn: parseAnkiCardDefaultFromFrontmatter(frontmatter),
    custom: customDefault,
  };

  if (customLayoutMap !== null) {
    result.customLayoutMap = customLayoutMap;
  }

  return result;
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
