import type { AnkiConnectClient, NoteInfo } from "./client";
import { AnkiConnectError } from "./client";
import type { Config } from "../config/configParser";
import { normalizeAnkiTagList, normalizeAnkiTagPath } from "./tagNormalize";
import {
  buildAnkiDuplicateRecoveredWarning,
  type DuplicateWarning,
} from "./duplicateDetect";
import { normalizeCodeBlockLineEndings } from "./htmlNormalize";

export type { DuplicateWarning } from "./duplicateDetect";

export type CardSyncPayload = {
  deck: string;
  tag: string;
  frontHtml: string;
  backHtml: string;
  ankiId?: string;
  wouldInjectId?: string;
  fileAnkiTags?: string[];
  sourceFile?: string;
};

export type CardSyncResult = {
  action: "add" | "update" | "skip";
  ankiNoteId?: number;
  injectedId?: string;
  error?: string;
  duplicateWarning?: DuplicateWarning;
};

export type SyncEngineConfig = Pick<
  Config,
  "noteModelName" | "syncTagPrefix" | "autoCreateDecks" | "defaultEngineTag"
>;

export type BuildAnkiTagsInput = {
  engineTag: string;
  fileTags: string[];
  headingTag: string;
  syncTagPrefix: string;
  uuid: string;
};

export function buildObsidianIdTag(prefix: string, uuid: string): string {
  return normalizeAnkiTagPath(`${prefix}::${uuid}`);
}

export function buildAnkiTags(input: BuildAnkiTagsInput): string[] {
  const tags: string[] = [input.engineTag, ...input.fileTags];

  if (input.headingTag.length > 0) {
    tags.push(input.headingTag);
  }

  tags.push(buildObsidianIdTag(input.syncTagPrefix, input.uuid));
  return normalizeAnkiTagList(tags);
}

export function isDuplicateNoteError(error: unknown): boolean {
  return (
    error instanceof AnkiConnectError &&
    error.message.toLowerCase().includes("duplicate")
  );
}

function extractUuidFromTags(
  tags: string[],
  syncTagPrefix: string,
): string | undefined {
  const prefix = `${syncTagPrefix}::`;
  for (const tag of tags) {
    if (tag.startsWith(prefix)) {
      return tag.slice(prefix.length);
    }
  }
  return undefined;
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

export async function findNoteByFrontInDeck(
  client: AnkiConnectClient,
  deck: string,
  frontHtml: string,
): Promise<NoteInfo | undefined> {
  const escapedDeck = deck.replace(/"/g, '\\"');
  const noteIds = await client.findNotes(`deck:"${escapedDeck}"`);
  if (noteIds.length === 0) {
    return undefined;
  }

  const notes = await client.notesInfo(noteIds);
  const matches = notes.filter(
    (note) => (note.fields.Front?.value ?? "") === frontHtml,
  );

  if (matches.length > 1) {
    throw new Error(
      `Multiple Anki notes in deck "${deck}" with identical Front field`,
    );
  }

  return matches[0];
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

function normalizeSyncFieldHtml(html: string): string {
  return normalizeCodeBlockLineEndings(html);
}

function buildSyncFields(
  frontHtml: string,
  backHtml: string,
): Record<string, string> {
  return {
    Front: normalizeSyncFieldHtml(frontHtml),
    Back: normalizeSyncFieldHtml(backHtml),
  };
}

function fieldsChanged(
  noteInfo: { fields: Record<string, { value: string }> },
  frontHtml: string,
  backHtml: string,
): boolean {
  const front = normalizeSyncFieldHtml(noteInfo.fields.Front?.value ?? "");
  const back = normalizeSyncFieldHtml(noteInfo.fields.Back?.value ?? "");
  return (
    front !== normalizeSyncFieldHtml(frontHtml) ||
    back !== normalizeSyncFieldHtml(backHtml)
  );
}

function tagsChanged(noteInfo: { tags: string[] }, tags: string[]): boolean {
  const current = [...noteInfo.tags].sort();
  const next = [...tags].sort();
  if (current.length !== next.length) {
    return true;
  }
  return current.some((tag, index) => tag !== next[index]);
}

async function updateExistingNote(
  client: AnkiConnectClient,
  noteId: number,
  noteInfo: NoteInfo,
  fields: Record<string, string>,
  tags: string[],
): Promise<"update" | "skip"> {
  const needsFieldUpdate = fieldsChanged(noteInfo, fields.Front, fields.Back);
  const needsTagUpdate = tagsChanged(noteInfo, tags);

  if (!needsFieldUpdate && !needsTagUpdate) {
    return "skip";
  }

  if (needsFieldUpdate) {
    await client.updateNoteFields(noteId, fields);
  }

  if (needsTagUpdate) {
    await client.updateNoteTags(noteId, tags);
  }

  return "update";
}

async function recoverDuplicateNote(
  client: AnkiConnectClient,
  payload: CardSyncPayload,
  config: SyncEngineConfig,
  fields: Record<string, string>,
  tags: string[],
): Promise<CardSyncResult> {
  const duplicate = await findNoteByFrontInDeck(
    client,
    payload.deck,
    payload.frontHtml,
  );
  if (!duplicate) {
    throw new AnkiConnectError("cannot create note because it is a duplicate");
  }

  const existingUuid = extractUuidFromTags(
    duplicate.tags,
    config.syncTagPrefix,
  );
  const linkUuid = existingUuid ?? payload.wouldInjectId;
  if (!linkUuid) {
    throw new Error("Card sync payload missing obsidian uuid for duplicate recovery");
  }

  const linkTags = buildAnkiTags({
    engineTag: config.defaultEngineTag,
    fileTags: payload.fileAnkiTags ?? [],
    headingTag: payload.tag,
    syncTagPrefix: config.syncTagPrefix,
    uuid: linkUuid,
  });

  const action = await updateExistingNote(
    client,
    duplicate.noteId,
    duplicate,
    fields,
    linkTags,
  );

  return {
    action,
    ankiNoteId: duplicate.noteId,
    injectedId: payload.ankiId ? undefined : linkUuid,
    duplicateWarning: buildAnkiDuplicateRecoveredWarning({
      deck: payload.deck,
      tag: payload.tag,
      frontHtml: payload.frontHtml,
      backHtml: payload.backHtml,
      sourceFile: payload.sourceFile,
      ankiNoteId: duplicate.noteId,
      linkedObsidianId: linkUuid,
    }),
  };
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

  const tags = buildAnkiTags({
    engineTag: config.defaultEngineTag,
    fileTags: payload.fileAnkiTags ?? [],
    headingTag: payload.tag,
    syncTagPrefix: config.syncTagPrefix,
    uuid,
  });
  const fields = buildSyncFields(payload.frontHtml, payload.backHtml);

  const existingNoteId = await findNoteByObsidianId(
    client,
    config.syncTagPrefix,
    uuid,
  );

  if (existingNoteId === undefined) {
    try {
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
    } catch (error) {
      if (!isDuplicateNoteError(error)) {
        throw error;
      }
      return recoverDuplicateNote(client, payload, config, fields, tags);
    }
  }

  const [noteInfo] = await client.notesInfo([existingNoteId]);
  if (!noteInfo) {
    throw new Error(`Anki note ${existingNoteId} not found`);
  }

  const action = await updateExistingNote(
    client,
    existingNoteId,
    noteInfo,
    fields,
    tags,
  );

  return { action, ankiNoteId: existingNoteId };
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
    try {
      const result = await syncCard(client, item.payload, config);
      results.push(result);

      if (result.injectedId && item.injectionOffset !== undefined) {
        injections.push({
          offset: item.injectionOffset,
          uuid: result.injectedId,
        });
      }
    } catch (error) {
      results.push({
        action: "skip",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { results, injections };
}
