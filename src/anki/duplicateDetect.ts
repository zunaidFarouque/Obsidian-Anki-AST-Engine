export type DuplicateCardSource = {
  file: string;
  deck: string;
  tag: string;
  frontHtml: string;
  backHtml: string;
  ankiId?: string;
};

export type DuplicateWarning = {
  kind: "vault_front_collision" | "back_mismatch" | "anki_duplicate_recovered";
  deck: string;
  frontHtml: string;
  message: string;
  sources: Array<{
    file: string;
    tag: string;
    ankiId?: string;
    backHtml: string;
  }>;
  ankiNoteId?: number;
  linkedObsidianId?: string;
};

function collisionKey(deck: string, frontHtml: string): string {
  return `${deck}\0${frontHtml}`;
}

export function cardExclusionKey(
  file: string,
  tag: string,
  deck: string,
  frontHtml: string,
): string {
  return `${file}\0${tag}\0${deck}\0${frontHtml}`;
}

export function buildExcludedCardKeysFromWarnings(
  warnings: DuplicateWarning[],
): Set<string> {
  const keys = new Set<string>();

  for (const warning of warnings) {
    if (
      warning.kind !== "vault_front_collision" &&
      warning.kind !== "back_mismatch"
    ) {
      continue;
    }

    for (const source of warning.sources) {
      keys.add(
        cardExclusionKey(
          source.file,
          source.tag,
          warning.deck,
          warning.frontHtml,
        ),
      );
    }
  }

  return keys;
}

export function detectVaultFrontCollisions(
  cards: DuplicateCardSource[],
): DuplicateWarning[] {
  const groups = new Map<string, DuplicateCardSource[]>();

  for (const card of cards) {
    const key = collisionKey(card.deck, card.frontHtml);
    const group = groups.get(key);
    if (group) {
      group.push(card);
    } else {
      groups.set(key, [card]);
    }
  }

  const warnings: DuplicateWarning[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const uniqueBacks = new Set(group.map((card) => card.backHtml));
    const kind =
      uniqueBacks.size > 1 ? "back_mismatch" : "vault_front_collision";
    const deck = group[0]!.deck;
    const frontHtml = group[0]!.frontHtml;
    const sources = group.map((card) => ({
      file: card.file,
      tag: card.tag,
      ankiId: card.ankiId,
      backHtml: card.backHtml,
    }));

    const fileList = sources.map((source) => source.file).join(", ");
    const message =
      kind === "back_mismatch"
        ? `Multiple vault cards share the same Front HTML in deck "${deck}" but have different Back HTML. Spaced repetition will keep overwriting the answer. Files: ${fileList}`
        : `Multiple vault cards share the same Front HTML in deck "${deck}". They will map to one Anki note. Files: ${fileList}`;

    warnings.push({
      kind,
      deck,
      frontHtml,
      message,
      sources,
    });
  }

  return warnings;
}

export function buildAnkiDuplicateRecoveredWarning(input: {
  deck: string;
  tag: string;
  frontHtml: string;
  backHtml: string;
  sourceFile?: string;
  ankiNoteId: number;
  linkedObsidianId: string;
}): DuplicateWarning {
  return {
    kind: "anki_duplicate_recovered",
    deck: input.deck,
    frontHtml: input.frontHtml,
    message: `Anki rejected a new note as a duplicate Front in deck "${input.deck}". Linked to existing note ${input.ankiNoteId} instead of creating a second card.`,
    sources: [
      {
        file: input.sourceFile ?? "",
        tag: input.tag,
        ankiId: input.linkedObsidianId,
        backHtml: input.backHtml,
      },
    ],
    ankiNoteId: input.ankiNoteId,
    linkedObsidianId: input.linkedObsidianId,
  };
}
