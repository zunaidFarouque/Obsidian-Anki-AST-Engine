import pLimit from "p-limit";
import type { AnkiConnectClient, NoteInfo } from "./client";
import { AnkiConnectError } from "./client";
import type { Config } from "../config/configParser";
import { createDeckEnsurer, type DeckEnsurer } from "./deckEnsurer";
import { createModelEnsurer, type ModelEnsurer } from "./modelEnsurer";
import {
  findNoteByFrontInDeck,
  normalizeSyncFieldHtml,
} from "./frontSearch";
import { resolveExistingNoteForRelink } from "./noteRelink";
import { normalizeAnkiTagList, normalizeAnkiTagPath } from "./tagNormalize";
import {
  buildAnkiDuplicateRecoveredWarning,
  type DuplicateWarning,
} from "./duplicateDetect";

export type { DuplicateWarning } from "./duplicateDetect";
export { findNoteByFrontInDeck } from "./frontSearch";

export type CardSyncPayload = {
  deck: string;
  tag: string;
  frontHtml: string;
  backHtml: string;
  /** Stock / resolved Anki model; defaults to config.noteModelName when omitted. */
  modelName?: string;
  /** Anki field map for the model; defaults to Front/Back from frontHtml/backHtml. */
  fields?: Record<string, string>;
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
  /** Present when vault resolved model ≠ Anki note modelName (02 D6). */
  typeMigration?: TypeMigrationInfo;
  /** Human-readable mismatch / migration notice for summaries. */
  modelMismatchWarning?: string;
};

export type TypeMigrationStatus =
  | "fields_updated_model_unchanged"
  | "blocked_incompatible_fields";

export type TypeMigrationInfo = {
  previousModel: string;
  targetModel: string;
  status: TypeMigrationStatus;
};

/**
 * AnkiConnect cannot change note type. When models differ:
 * - If all required field keys exist on the existing note → update fields in place
 *   and report type-migration (model remains wrong until user changes it in Anki).
 * - If required fields are missing → skip write (do not dump Cloze Text into Basic).
 */
export function assessModelMigration(
  noteInfo: Pick<NoteInfo, "modelName" | "fields">,
  targetModelName: string,
  fields: Record<string, string>,
):
  | { kind: "match" }
  | {
      kind: "compatible";
      previousModel: string;
      warning: string;
      typeMigration: TypeMigrationInfo;
    }
  | {
      kind: "incompatible";
      previousModel: string;
      error: string;
      warning: string;
      typeMigration: TypeMigrationInfo;
    } {
  const previousModel = noteInfo.modelName?.trim() || undefined;
  if (!previousModel || previousModel === targetModelName) {
    return { kind: "match" };
  }

  const missingFields = Object.keys(fields).filter(
    (key) => noteInfo.fields[key] === undefined,
  );

  if (missingFields.length > 0) {
    const warning =
      `Anki note model "${previousModel}" does not match vault type "${targetModelName}" ` +
      `(missing fields: ${missingFields.join(", ")}); change note type in Anki — AnkiConnect cannot migrate models`;
    return {
      kind: "incompatible",
      previousModel,
      error: warning,
      warning,
      typeMigration: {
        previousModel,
        targetModel: targetModelName,
        status: "blocked_incompatible_fields",
      },
    };
  }

  const warning =
    `Anki note model "${previousModel}" ≠ vault "${targetModelName}"; ` +
    `updated overlapping fields in place — change note type in Anki to finish migration (AnkiConnect cannot change models)`;
  return {
    kind: "compatible",
    previousModel,
    warning,
    typeMigration: {
      previousModel,
      targetModel: targetModelName,
      status: "fields_updated_model_unchanged",
    },
  };
}

export type SyncEngineConfig = Pick<
  Config,
  | "noteModelName"
  | "syncTagPrefix"
  | "autoCreateDecks"
  | "autoCreateStockNoteModels"
  | "defaultEngineTag"
>;

export const DEFAULT_SYNC_CONCURRENCY = 10;
export const DEFAULT_ADD_NOTES_CHUNK = 50;

export type SyncRunContext = {
  deckEnsurer: DeckEnsurer;
  modelEnsurer: ModelEnsurer;
  syncLimit: ReturnType<typeof pLimit>;
  frontMatchCache: Map<string, NoteInfo | undefined>;
};

export function createSyncRunContext(
  client: AnkiConnectClient,
  config: SyncEngineConfig,
  options?: { concurrency?: number },
): SyncRunContext {
  return {
    deckEnsurer: createDeckEnsurer(client, config.autoCreateDecks),
    modelEnsurer: createModelEnsurer(
      client,
      config.autoCreateStockNoteModels ?? true,
    ),
    syncLimit: pLimit(options?.concurrency ?? DEFAULT_SYNC_CONCURRENCY),
    frontMatchCache: new Map(),
  };
}

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
    error instanceof Error &&
    error.message.toLowerCase().includes("duplicate")
  );
}

export function extractUuidFromTags(
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

export async function ensureStockModel(
  client: AnkiConnectClient,
  modelName: string,
  autoCreateStockNoteModels: boolean,
): Promise<void> {
  const ensurer = createModelEnsurer(client, autoCreateStockNoteModels);
  await ensurer.ensureModel(modelName);
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

function resolvePayloadFields(payload: CardSyncPayload): Record<string, string> {
  return payload.fields ?? buildSyncFields(payload.frontHtml, payload.backHtml);
}

function resolvePayloadModelName(
  payload: CardSyncPayload,
  config: SyncEngineConfig,
): string {
  return payload.modelName ?? config.noteModelName;
}

function fieldsChanged(
  noteInfo: { fields: Record<string, { value: string }> },
  fields: Record<string, string>,
): boolean {
  for (const [key, value] of Object.entries(fields)) {
    const current = normalizeSyncFieldHtml(noteInfo.fields[key]?.value ?? "");
    if (current !== normalizeSyncFieldHtml(value)) {
      return true;
    }
  }
  return false;
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
  const needsFieldUpdate = fieldsChanged(noteInfo, fields);
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

async function updateExistingNoteWithMigration(
  client: AnkiConnectClient,
  noteId: number,
  noteInfo: NoteInfo,
  fields: Record<string, string>,
  tags: string[],
  targetModelName: string,
): Promise<CardSyncResult> {
  const migration = assessModelMigration(noteInfo, targetModelName, fields);

  if (migration.kind === "incompatible") {
    return {
      action: "skip",
      ankiNoteId: noteId,
      error: migration.error,
      typeMigration: migration.typeMigration,
      modelMismatchWarning: migration.warning,
    };
  }

  const action = await updateExistingNote(
    client,
    noteId,
    noteInfo,
    fields,
    tags,
  );

  if (migration.kind === "compatible") {
    return {
      action,
      ankiNoteId: noteId,
      typeMigration: migration.typeMigration,
      modelMismatchWarning: migration.warning,
    };
  }

  return { action, ankiNoteId: noteId };
}

async function linkExistingNoteByFront(
  client: AnkiConnectClient,
  payload: CardSyncPayload,
  config: SyncEngineConfig,
  existing: NoteInfo,
  fields: Record<string, string>,
): Promise<CardSyncResult> {
  const existingUuid = extractUuidFromTags(
    existing.tags,
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

  const modelName = resolvePayloadModelName(payload, config);
  const migrated = await updateExistingNoteWithMigration(
    client,
    existing.noteId,
    existing,
    fields,
    linkTags,
    modelName,
  );

  return {
    ...migrated,
    injectedId: payload.ankiId ? undefined : linkUuid,
    duplicateWarning: buildAnkiDuplicateRecoveredWarning({
      deck: payload.deck,
      tag: payload.tag,
      frontHtml: payload.frontHtml,
      backHtml: payload.backHtml,
      sourceFile: payload.sourceFile,
      ankiNoteId: existing.noteId,
      linkedObsidianId: linkUuid,
    }),
  };
}

async function recoverDuplicateNote(
  client: AnkiConnectClient,
  payload: CardSyncPayload,
  config: SyncEngineConfig,
  fields: Record<string, string>,
  tags: string[],
  context?: SyncRunContext,
): Promise<CardSyncResult> {
  const duplicate = await resolveExistingNoteForRelink(
    client,
    {
      deck: payload.deck,
      tag: payload.tag,
      frontHtml: payload.frontHtml,
    },
    context?.frontMatchCache,
  );
  if (!duplicate) {
    throw new AnkiConnectError(
      `cannot create note because it is a duplicate, but no matching Anki note was found in deck "${payload.deck}" (tried front, heading tag, and keyword search)`,
    );
  }

  return linkExistingNoteByFront(
    client,
    payload,
    config,
    duplicate,
    fields,
  );
}

export async function syncCard(
  client: AnkiConnectClient,
  payload: CardSyncPayload,
  config: SyncEngineConfig,
  context?: SyncRunContext,
): Promise<CardSyncResult> {
  const uuid = payload.ankiId ?? payload.wouldInjectId;
  if (!uuid) {
    throw new Error("Card sync payload missing obsidian uuid");
  }

  if (context) {
    await context.deckEnsurer.ensureDeck(payload.deck);
  } else {
    await ensureDeck(client, payload.deck, config.autoCreateDecks);
  }

  const tags = buildAnkiTags({
    engineTag: config.defaultEngineTag,
    fileTags: payload.fileAnkiTags ?? [],
    headingTag: payload.tag,
    syncTagPrefix: config.syncTagPrefix,
    uuid,
  });
  const fields = resolvePayloadFields(payload);
  const modelName = resolvePayloadModelName(payload, config);

  if (context) {
    await context.modelEnsurer.ensureModel(modelName);
  } else {
    await ensureStockModel(
      client,
      modelName,
      config.autoCreateStockNoteModels ?? true,
    );
  }

  const existingNoteId = await findNoteByObsidianId(
    client,
    config.syncTagPrefix,
    uuid,
  );

  if (existingNoteId === undefined) {
    const existingForRelink = await resolveExistingNoteForRelink(
      client,
      {
        deck: payload.deck,
        tag: payload.tag,
        frontHtml: payload.frontHtml,
      },
      context?.frontMatchCache,
    );
    if (existingForRelink) {
      return linkExistingNoteByFront(
        client,
        payload,
        config,
        existingForRelink,
        fields,
      );
    }

    try {
      const noteId = await client.addNote({
        deckName: payload.deck,
        modelName,
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
      return recoverDuplicateNote(client, payload, config, fields, tags, context);
    }
  }

  const [noteInfo] = await client.notesInfo([existingNoteId]);
  if (!noteInfo) {
    throw new Error(`Anki note ${existingNoteId} not found`);
  }

  return updateExistingNoteWithMigration(
    client,
    existingNoteId,
    noteInfo,
    fields,
    tags,
    modelName,
  );
}

export type FileCardSyncItem = {
  payload: CardSyncPayload;
  injectionOffset?: number;
};

export type FileSyncResult = {
  results: CardSyncResult[];
  injections: Array<{ offset: number; uuid: string }>;
};

type PreparedCardItem = {
  index: number;
  item: FileCardSyncItem;
  uuid: string;
  tags: string[];
  fields: Record<string, string>;
};

function prepareCardItemsWithConfig(
  items: FileCardSyncItem[],
  config: SyncEngineConfig,
): PreparedCardItem[] {
  return items.map((item, index) => {
    const uuid = item.payload.ankiId ?? item.payload.wouldInjectId;
    if (!uuid) {
      throw new Error("Card sync payload missing obsidian uuid");
    }

    return {
      index,
      item,
      uuid,
      tags: buildAnkiTags({
        engineTag: config.defaultEngineTag,
        fileTags: item.payload.fileAnkiTags ?? [],
        headingTag: item.payload.tag,
        syncTagPrefix: config.syncTagPrefix,
        uuid,
      }),
      fields: resolvePayloadFields(item.payload),
    };
  });
}

async function ensureDecksForItems(
  context: SyncRunContext,
  items: FileCardSyncItem[],
): Promise<void> {
  const decks = new Set(items.map((item) => item.payload.deck));
  await Promise.all(
    [...decks].map((deck) => context.deckEnsurer.ensureDeck(deck)),
  );
}

async function ensureModelsForPrepared(
  context: SyncRunContext,
  prepared: PreparedCardItem[],
  config: SyncEngineConfig,
): Promise<void> {
  const modelNames = new Set(
    prepared.map((entry) =>
      resolvePayloadModelName(entry.item.payload, config),
    ),
  );
  await Promise.all(
    [...modelNames].map((modelName) =>
      context.modelEnsurer.ensureModel(modelName),
    ),
  );
}

async function batchResolveExistingNoteIds(
  client: AnkiConnectClient,
  prepared: PreparedCardItem[],
  config: SyncEngineConfig,
): Promise<Map<number, number | undefined>> {
  if (prepared.length === 0) {
    return new Map();
  }

  const results = await client.invokeMulti<number[][]>(
    prepared.map((entry) => ({
      action: "findNotes",
      params: {
        query: `tag:"${buildObsidianIdTag(config.syncTagPrefix, entry.uuid)}"`,
      },
    })),
  );

  const existingByIndex = new Map<number, number | undefined>();
  for (let i = 0; i < prepared.length; i += 1) {
    const entry = prepared[i]!;
    const noteIds = results[i] ?? [];
    if (noteIds.length > 1) {
      throw new Error(`Duplicate Anki notes for obsidian id ${entry.uuid}`);
    }
    existingByIndex.set(entry.index, noteIds[0]);
  }

  return existingByIndex;
}

async function addPreparedCard(
  client: AnkiConnectClient,
  prepared: PreparedCardItem,
  config: SyncEngineConfig,
  context?: SyncRunContext,
): Promise<CardSyncResult> {
  const existingForRelink = await resolveExistingNoteForRelink(
    client,
    {
      deck: prepared.item.payload.deck,
      tag: prepared.item.payload.tag,
      frontHtml: prepared.item.payload.frontHtml,
    },
    context?.frontMatchCache,
  );
  if (existingForRelink) {
    return linkExistingNoteByFront(
      client,
      prepared.item.payload,
      config,
      existingForRelink,
      prepared.fields,
    );
  }

  try {
    const noteId = await client.addNote({
      deckName: prepared.item.payload.deck,
      modelName: resolvePayloadModelName(prepared.item.payload, config),
      fields: prepared.fields,
      tags: prepared.tags,
    });

    return {
      action: "add",
      ankiNoteId: noteId,
      injectedId: prepared.item.payload.wouldInjectId,
    };
  } catch (error) {
    if (!isDuplicateNoteError(error)) {
      throw error;
    }
    return recoverDuplicateNote(
      client,
      prepared.item.payload,
      config,
      prepared.fields,
      prepared.tags,
      context,
    );
  }
}

async function syncPreparedUpdates(
  client: AnkiConnectClient,
  updates: Array<{ prepared: PreparedCardItem; noteId: number }>,
  noteInfoById: Map<number, NoteInfo>,
  config: SyncEngineConfig,
  context: SyncRunContext,
  results: CardSyncResult[],
): Promise<void> {
  await Promise.all(
    updates.map(({ prepared, noteId }) =>
      context.syncLimit(async () => {
        try {
          const noteInfo = noteInfoById.get(noteId);
          if (!noteInfo) {
            throw new Error(`Anki note ${noteId} not found`);
          }

          results[prepared.index] = await updateExistingNoteWithMigration(
            client,
            noteId,
            noteInfo,
            prepared.fields,
            prepared.tags,
            resolvePayloadModelName(prepared.item.payload, config),
          );
        } catch (error) {
          results[prepared.index] = {
            action: "skip",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    ),
  );
}

async function syncPreparedAdds(
  client: AnkiConnectClient,
  preparedAdds: PreparedCardItem[],
  config: SyncEngineConfig,
  context: SyncRunContext,
  results: CardSyncResult[],
): Promise<void> {
  for (
    let chunkStart = 0;
    chunkStart < preparedAdds.length;
    chunkStart += DEFAULT_ADD_NOTES_CHUNK
  ) {
    const chunk = preparedAdds.slice(
      chunkStart,
      chunkStart + DEFAULT_ADD_NOTES_CHUNK,
    );

    try {
      const noteIds = await client.addNotes(
        chunk.map((entry) => ({
          deckName: entry.item.payload.deck,
          modelName: resolvePayloadModelName(entry.item.payload, config),
          fields: entry.fields,
          tags: entry.tags,
        })),
      );

      for (let i = 0; i < chunk.length; i += 1) {
        const entry = chunk[i]!;
        const noteId = noteIds[i];
        if (noteId !== null && noteId !== undefined) {
          results[entry.index] = {
            action: "add",
            ankiNoteId: noteId,
            injectedId: entry.item.payload.wouldInjectId,
          };
          continue;
        }

        try {
          results[entry.index] = await recoverDuplicateNote(
            client,
            entry.item.payload,
            config,
            entry.fields,
            entry.tags,
            context,
          );
        } catch (error) {
          results[entry.index] = {
            action: "skip",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    } catch {
      for (const entry of chunk) {
        if (results[entry.index] !== undefined) {
          continue;
        }

        try {
          results[entry.index] = await addPreparedCard(
            client,
            entry,
            config,
            context,
          );
        } catch (error) {
          results[entry.index] = {
            action: "skip",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }
  }
}

function collectFileSyncInjections(
  items: FileCardSyncItem[],
  results: CardSyncResult[],
): Array<{ offset: number; uuid: string }> {
  const injections: Array<{ offset: number; uuid: string }> = [];

  for (let index = 0; index < items.length; index += 1) {
    const result = results[index];
    const item = items[index];
    if (
      result?.injectedId &&
      item?.injectionOffset !== undefined
    ) {
      injections.push({
        offset: item.injectionOffset,
        uuid: result.injectedId,
      });
    }
  }

  return injections;
}

async function syncFileCardsBatched(
  client: AnkiConnectClient,
  items: FileCardSyncItem[],
  config: SyncEngineConfig,
  context: SyncRunContext,
): Promise<FileSyncResult> {
  if (items.length === 0) {
    return { results: [], injections: [] };
  }

  const prepared = prepareCardItemsWithConfig(items, config);
  await ensureDecksForItems(context, items);

  const results: CardSyncResult[] = new Array(items.length);
  let existingByIndex: Map<number, number | undefined>;

  try {
    await ensureModelsForPrepared(context, prepared, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (let index = 0; index < items.length; index += 1) {
      results[index] = { action: "skip", error: message };
    }
    return { results, injections: [] };
  }

  try {
    existingByIndex = await batchResolveExistingNoteIds(
      client,
      prepared,
      config,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (let index = 0; index < items.length; index += 1) {
      results[index] = { action: "skip", error: message };
    }
    return { results, injections: [] };
  }

  const updates: Array<{ prepared: PreparedCardItem; noteId: number }> = [];
  const preparedAdds: PreparedCardItem[] = [];

  for (const entry of prepared) {
    const existingNoteId = existingByIndex.get(entry.index);
    if (existingNoteId === undefined) {
      preparedAdds.push(entry);
    } else {
      updates.push({ prepared: entry, noteId: existingNoteId });
    }
  }

  const frontLinkedResults: Array<{
    prepared: PreparedCardItem;
    result: CardSyncResult;
  }> = [];
  const remainingAdds: PreparedCardItem[] = [];

  for (const entry of preparedAdds) {
    const existingForRelink = await resolveExistingNoteForRelink(
      client,
      {
        deck: entry.item.payload.deck,
        tag: entry.item.payload.tag,
        frontHtml: entry.item.payload.frontHtml,
      },
      context.frontMatchCache,
    );
    if (existingForRelink) {
      try {
        const result = await linkExistingNoteByFront(
          client,
          entry.item.payload,
          config,
          existingForRelink,
          entry.fields,
        );
        frontLinkedResults.push({ prepared: entry, result });
      } catch (error) {
        results[entry.index] = {
          action: "skip",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    } else {
      remainingAdds.push(entry);
    }
  }

  for (const { prepared: entry, result } of frontLinkedResults) {
    results[entry.index] = result;
  }

  const noteIds = [
    ...new Set(updates.map((entry) => entry.noteId)),
  ];
  const noteInfos = noteIds.length > 0 ? await client.notesInfo(noteIds) : [];
  const noteInfoById = new Map(noteInfos.map((note) => [note.noteId, note]));

  await syncPreparedUpdates(
    client,
    updates,
    noteInfoById,
    config,
    context,
    results,
  );
  await syncPreparedAdds(client, remainingAdds, config, context, results);

  for (let index = 0; index < results.length; index += 1) {
    if (results[index] === undefined) {
      results[index] = {
        action: "skip",
        error: "Card sync did not produce a result",
      };
    }
  }

  return {
    results,
    injections: collectFileSyncInjections(items, results),
  };
}

async function syncFileCardsParallel(
  client: AnkiConnectClient,
  items: FileCardSyncItem[],
  config: SyncEngineConfig,
  context?: SyncRunContext,
): Promise<FileSyncResult> {
  const limit = context?.syncLimit ?? pLimit(1);

  const settled = await Promise.all(
    items.map((item, index) =>
      limit(async () => {
        try {
          const result = await syncCard(client, item.payload, config, context);
          return { index, result, item };
        } catch (error) {
          return {
            index,
            result: {
              action: "skip" as const,
              error: error instanceof Error ? error.message : String(error),
            },
            item,
          };
        }
      }),
    ),
  );

  settled.sort((a, b) => a.index - b.index);

  const results: CardSyncResult[] = [];
  const injections: Array<{ offset: number; uuid: string }> = [];

  for (const entry of settled) {
    results.push(entry.result);

    if (
      entry.result.injectedId &&
      entry.item.injectionOffset !== undefined
    ) {
      injections.push({
        offset: entry.item.injectionOffset,
        uuid: entry.result.injectedId,
      });
    }
  }

  return { results, injections };
}

export async function syncFileCards(
  client: AnkiConnectClient,
  items: FileCardSyncItem[],
  config: SyncEngineConfig,
  context?: SyncRunContext,
): Promise<FileSyncResult> {
  if (context) {
    return syncFileCardsBatched(client, items, config, context);
  }

  return syncFileCardsParallel(client, items, config, context);
}
