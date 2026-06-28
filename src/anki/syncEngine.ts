import type { AnkiConnectClient } from "./client";
import type { Config } from "../config/configParser";

export type CardSyncPayload = {
  deck: string;
  tag: string;
  frontHtml: string;
  backHtml: string;
  ankiId?: string;
  wouldInjectId?: string;
};

export type CardSyncResult = {
  action: "add" | "update" | "skip";
  ankiNoteId?: number;
  injectedId?: string;
};

export type SyncEngineConfig = Pick<
  Config,
  "noteModelName" | "syncTagPrefix" | "autoCreateDecks"
>;

export function buildObsidianIdTag(prefix: string, uuid: string): string {
  return `${prefix}::${uuid}`;
}

export function buildAnkiTags(
  headingTag: string,
  syncTagPrefix: string,
  uuid: string,
): string[] {
  const tags = headingTag.length > 0 ? [headingTag] : [];
  tags.push(buildObsidianIdTag(syncTagPrefix, uuid));
  return tags;
}

export async function findNoteByObsidianId(
  client: AnkiConnectClient,
  syncTagPrefix: string,
  uuid: string,
): Promise<number | undefined> {
  const tag = buildObsidianIdTag(syncTagPrefix, uuid);
  const noteIds = await client.findNotes(`tag:"${tag}"`);
  if (noteIds.length === 0) {
    return undefined;
  }
  if (noteIds.length > 1) {
    throw new Error(`Duplicate Anki notes for obsidian id ${uuid}`);
  }
  return noteIds[0];
}

export async function ensureDeck(
  client: AnkiConnectClient,
  deckName: string,
  autoCreateDecks: boolean,
): Promise<void> {
  const decks = await client.deckNames();
  if (decks.includes(deckName)) {
    return;
  }

  if (!autoCreateDecks) {
    throw new Error(`Anki deck not found: ${deckName}`);
  }

  await client.createDeck(deckName);
}

function fieldsChanged(
  noteInfo: { fields: Record<string, { value: string }> },
  frontHtml: string,
  backHtml: string,
): boolean {
  const front = noteInfo.fields.Front?.value ?? "";
  const back = noteInfo.fields.Back?.value ?? "";
  return front !== frontHtml || back !== backHtml;
}

function tagsChanged(noteInfo: { tags: string[] }, tags: string[]): boolean {
  const current = [...noteInfo.tags].sort();
  const next = [...tags].sort();
  if (current.length !== next.length) {
    return true;
  }
  return current.some((tag, index) => tag !== next[index]);
}

export async function syncCard(
  client: AnkiConnectClient,
  payload: CardSyncPayload,
  config: SyncEngineConfig,
): Promise<CardSyncResult> {
  const uuid = payload.ankiId ?? payload.wouldInjectId;
  if (!uuid) {
    throw new Error("Card sync payload missing obsidian uuid");
  }

  await ensureDeck(client, payload.deck, config.autoCreateDecks);

  const tags = buildAnkiTags(payload.tag, config.syncTagPrefix, uuid);
  const fields = {
    Front: payload.frontHtml,
    Back: payload.backHtml,
  };

  const existingNoteId = await findNoteByObsidianId(
    client,
    config.syncTagPrefix,
    uuid,
  );

  if (existingNoteId === undefined) {
    const noteId = await client.addNote({
      deckName: payload.deck,
      modelName: config.noteModelName,
      fields,
      tags,
    });

    return {
      action: "add",
      ankiNoteId: noteId,
      injectedId: payload.wouldInjectId,
    };
  }

  const [noteInfo] = await client.notesInfo([existingNoteId]);
  if (!noteInfo) {
    throw new Error(`Anki note ${existingNoteId} not found`);
  }

  const needsFieldUpdate = fieldsChanged(noteInfo, payload.frontHtml, payload.backHtml);
  const needsTagUpdate = tagsChanged(noteInfo, tags);

  if (!needsFieldUpdate && !needsTagUpdate) {
    return { action: "skip", ankiNoteId: existingNoteId };
  }

  if (needsFieldUpdate) {
    await client.updateNoteFields(existingNoteId, fields);
  }

  if (needsTagUpdate) {
    await client.updateNoteTags(existingNoteId, tags);
  }

  return { action: "update", ankiNoteId: existingNoteId };
}

export type FileCardSyncItem = {
  payload: CardSyncPayload;
  injectionOffset?: number;
};

export type FileSyncResult = {
  results: CardSyncResult[];
  injections: Array<{ offset: number; uuid: string }>;
};

export async function syncFileCards(
  client: AnkiConnectClient,
  items: FileCardSyncItem[],
  config: SyncEngineConfig,
): Promise<FileSyncResult> {
  const results: CardSyncResult[] = [];
  const injections: Array<{ offset: number; uuid: string }> = [];

  for (const item of items) {
    const result = await syncCard(client, item.payload, config);
    results.push(result);

    if (result.injectedId && item.injectionOffset !== undefined) {
      injections.push({
        offset: item.injectionOffset,
        uuid: result.injectedId,
      });
    }
  }

  return { results, injections };
}
