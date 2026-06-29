import type { Config } from "../config/configParser";
import type { AnkiConnectClient } from "./client";
import { stripHtmlForSearch } from "./frontSearch";
import { extractUuidFromTags } from "./syncEngine";
import { normalizeAnkiTagPath } from "./tagNormalize";

const NOTES_INFO_CHUNK_SIZE = 50;

export type VaultOrphan = {
  ankiNoteId: number;
  uuid: string;
  deck?: string;
  preview?: string;
  tags: string[];
};

type NoteFields = Record<string, { value: string; order: number }>;

function readFirstPopulatedField(
  fields: NoteFields | undefined,
  names: string[],
): string | undefined {
  if (!fields) {
    return undefined;
  }
  for (const name of names) {
    const value = fields[name]?.value;
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function hasIgnoreTag(tags: string[], ignoreTag: string): boolean {
  const normalizedIgnoreTag = normalizeAnkiTagPath(ignoreTag);
  return tags.some((tag) => normalizeAnkiTagPath(tag) === normalizedIgnoreTag);
}

function cleanPreview(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const compact = stripHtmlForSearch(raw);
  if (compact.length === 0) {
    return undefined;
  }
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
}

async function enrichOrphansFromCards(
  client: AnkiConnectClient,
  orphans: VaultOrphan[],
  notesById: Map<number, { cards?: number[]; fields: NoteFields }>,
): Promise<void> {
  const cardIds: number[] = [];
  for (const orphan of orphans) {
    const note = notesById.get(orphan.ankiNoteId);
    const firstCardId = note?.cards?.[0];
    if (firstCardId !== undefined) {
      cardIds.push(firstCardId);
    }
  }

  if (cardIds.length === 0) {
    return;
  }

  const cards = await client.cardsInfo(cardIds);
  const cardByNoteId = new Map<number, (typeof cards)[number]>();
  for (const card of cards) {
    if (!cardByNoteId.has(card.note)) {
      cardByNoteId.set(card.note, card);
    }
  }

  for (const orphan of orphans) {
    const note = notesById.get(orphan.ankiNoteId);
    const card = cardByNoteId.get(orphan.ankiNoteId);
    if (card) {
      orphan.deck = card.deckName;
      const fromFields = cleanPreview(
        readFirstPopulatedField(note?.fields, ["Front", "Question"]),
      );
      const fromCardQuestion = cleanPreview(card.question);
      orphan.preview = fromFields ?? fromCardQuestion;
      continue;
    }

    orphan.preview =
      orphan.preview ??
      cleanPreview(readFirstPopulatedField(note?.fields, ["Front", "Question"]));
  }
}

export async function detectVaultOrphans(input: {
  client: AnkiConnectClient;
  config: Config;
  vaultBoundUuids: Set<string>;
}): Promise<VaultOrphan[]> {
  const { client, config, vaultBoundUuids } = input;
  const noteIds = await client.findNotes(`tag:"${config.defaultEngineTag}"`);
  if (noteIds.length === 0) {
    return [];
  }

  const orphans: VaultOrphan[] = [];
  const notesById = new Map<number, { cards?: number[]; fields: NoteFields }>();

  for (let index = 0; index < noteIds.length; index += NOTES_INFO_CHUNK_SIZE) {
    const chunk = noteIds.slice(index, index + NOTES_INFO_CHUNK_SIZE);
    const notes = await client.notesInfo(chunk);

    for (const note of notes) {
      notesById.set(note.noteId, {
        cards: note.cards,
        fields: note.fields,
      });

      const uuid = extractUuidFromTags(note.tags, config.syncTagPrefix);
      if (
        !uuid ||
        vaultBoundUuids.has(uuid) ||
        hasIgnoreTag(note.tags, config.orphanIgnoreTag)
      ) {
        continue;
      }

      orphans.push({
        ankiNoteId: note.noteId,
        uuid,
        preview: cleanPreview(
          readFirstPopulatedField(note.fields, ["Front", "Question"]),
        ),
        tags: note.tags,
      });
    }
  }

  await enrichOrphansFromCards(client, orphans, notesById);
  return orphans;
}
