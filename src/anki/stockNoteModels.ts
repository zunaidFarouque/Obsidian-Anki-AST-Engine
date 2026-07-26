/**
 * Stock Anki note-type mapping for built-in cardSyntax types.
 * @see Docs/DECIDING/DECIDED-Preview-Sync-Contract-2026-07.md §2
 * @see CurrentWorkMD/_DecisionsNeeded_02_CardTypesAnkiSync.md D2–D3, D5, D7
 */

import type { BuiltInCardType, ResolvedCardType } from "../cardSyntax/types";
import { extractTypedBackPlainText } from "../cardSyntax/layoutValidator";
import type { CreateModelParams } from "./client";
import { normalizeSyncFieldHtml } from "./frontSearch";

/** Hard-coded stock names (remapping deferred). */
export const STOCK_ANKI_MODEL_NAMES = {
  basic: "Basic",
  cloze: "Cloze",
  reversible: "Basic (and reversed card)",
  typed: "Basic (type in the answer)",
} as const satisfies Record<BuiltInCardType, string>;

const STOCK_MODEL_NAME_TO_BUILTIN = new Map<string, BuiltInCardType>(
  (Object.entries(STOCK_ANKI_MODEL_NAMES) as [BuiltInCardType, string][]).map(
    ([type, name]) => [name, type],
  ),
);

const DEFAULT_CARD_CSS = `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}
`;

const BASIC_FRONT_BACK_TEMPLATES = [
  {
    Name: "Card 1",
    Front: "{{Front}}",
    Back: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
  },
] as const;

export type AnkiNoteFields = Record<string, string>;

export function stockModelNameForBuiltin(type: BuiltInCardType): string {
  return STOCK_ANKI_MODEL_NAMES[type];
}

export function builtinTypeForStockModelName(
  modelName: string,
): BuiltInCardType | undefined {
  return STOCK_MODEL_NAME_TO_BUILTIN.get(modelName);
}

export function isStockAnkiModelName(modelName: string): boolean {
  return STOCK_MODEL_NAME_TO_BUILTIN.has(modelName);
}

/** AnkiConnect createModel params approximating stock built-in note types. */
export function stockModelCreateParams(
  type: BuiltInCardType,
): CreateModelParams {
  switch (type) {
    case "basic":
      return {
        modelName: STOCK_ANKI_MODEL_NAMES.basic,
        inOrderFields: ["Front", "Back"],
        css: DEFAULT_CARD_CSS,
        cardTemplates: [...BASIC_FRONT_BACK_TEMPLATES],
      };
    case "cloze":
      return {
        modelName: STOCK_ANKI_MODEL_NAMES.cloze,
        inOrderFields: ["Text", "Back Extra"],
        css: DEFAULT_CARD_CSS,
        isCloze: true,
        cardTemplates: [
          {
            Name: "Cloze",
            Front: "{{cloze:Text}}",
            Back: "{{cloze:Text}}<br>\n{{Back Extra}}",
          },
        ],
      };
    case "reversible":
      return {
        modelName: STOCK_ANKI_MODEL_NAMES.reversible,
        inOrderFields: ["Front", "Back"],
        css: DEFAULT_CARD_CSS,
        cardTemplates: [
          {
            Name: "Card 1",
            Front: "{{Front}}",
            Back: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
          },
          {
            Name: "Card 2",
            Front: "{{Back}}",
            Back: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}",
          },
        ],
      };
    case "typed":
      return {
        modelName: STOCK_ANKI_MODEL_NAMES.typed,
        inOrderFields: ["Front", "Back"],
        css: DEFAULT_CARD_CSS,
        cardTemplates: [
          {
            Name: "Card 1",
            Front: "{{Front}}\n\n{{type:Back}}",
            Back: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
          },
        ],
      };
  }
}

/**
 * Map compiled front/back HTML into Anki field names for a built-in type.
 * Typed answers are plain-text (TYP-03/04/05 / 02 D7).
 * TYP-05 pipe alternatives are normalized to `a|b|c` (spaces around `|` trimmed).
 */
export function buildAnkiFieldsForBuiltin(
  type: BuiltInCardType,
  frontHtml: string,
  backHtml: string,
): AnkiNoteFields {
  const front = normalizeSyncFieldHtml(frontHtml);
  const back = normalizeSyncFieldHtml(backHtml);

  switch (type) {
    case "cloze":
      return {
        Text: front,
        "Back Extra": back,
      };
    case "typed":
      return {
        Front: front,
        Back: extractTypedBackPlainText(backHtml),
      };
    case "basic":
    case "reversible":
      return {
        Front: front,
        Back: back,
      };
  }
}

export type SyncNoteModelPlan =
  | {
      kind: "builtin";
      builtinType: BuiltInCardType;
      modelName: string;
      fields: AnkiNoteFields;
    }
  | {
      kind: "custom";
      noteTypeId: string;
      notImplementedMessage: string;
    }
  | {
      kind: "fallback";
      modelName: string;
      fields: AnkiNoteFields;
    };

/**
 * Resolve Anki model + fields from cardSyntax `resolvedType`.
 * Custom types are identified but not synced (Phase 3).
 */
export function planNoteModelForResolvedType(
  resolvedType: ResolvedCardType | undefined,
  frontHtml: string,
  backHtml: string,
  fallbackModelName: string,
): SyncNoteModelPlan {
  if (!resolvedType) {
    return {
      kind: "fallback",
      modelName: fallbackModelName,
      fields: buildAnkiFieldsForBuiltin("basic", frontHtml, backHtml),
    };
  }

  if (resolvedType.kind === "custom") {
    return {
      kind: "custom",
      noteTypeId: resolvedType.noteTypeId,
      notImplementedMessage: `Custom note type "${resolvedType.noteTypeId}" sync is not yet implemented`,
    };
  }

  return {
    kind: "builtin",
    builtinType: resolvedType.type,
    modelName: stockModelNameForBuiltin(resolvedType.type),
    fields: buildAnkiFieldsForBuiltin(
      resolvedType.type,
      frontHtml,
      backHtml,
    ),
  };
}
