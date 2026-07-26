import { z } from "zod";
import pLimit from "p-limit";
import type { Config } from "../config/configParser";

const ANKI_CONNECT_VERSION = 6;
export const DEFAULT_INVOKE_CONCURRENCY = 5;
const INVOKE_MAX_ATTEMPTS = 3;
const INVOKE_RETRY_BASE_MS = 50;

const TRANSIENT_ERROR_PATTERN =
  /unable to connect|failed to fetch|network|econnreset|econnrefused|socket hang up/i;

const AnkiResponseSchema = z.object({
  result: z.unknown(),
  error: z.union([z.string(), z.null()]),
});

export class AnkiConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnkiConnectError";
  }
}

export type AnkiClientOptions = {
  url: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  requestConcurrency?: number;
  retryBaseDelayMs?: number;
};

export function isRetryableAnkiConnectError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof AnkiConnectError) {
    return TRANSIENT_ERROR_PATTERN.test(error.message);
  }

  return false;
}

function invokeRetryDelayMs(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * 2 ** (attempt - 1);
}

export type AddNoteParams = {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
};

export type CreateModelCardTemplate = {
  Name: string;
  Front: string;
  Back: string;
};

export type CreateModelParams = {
  modelName: string;
  inOrderFields: string[];
  cardTemplates: CreateModelCardTemplate[];
  css?: string;
  isCloze?: boolean;
};

export type NoteInfo = {
  noteId: number;
  /** Present on AnkiConnect notesInfo; used for model-mismatch / migration. */
  modelName?: string;
  tags: string[];
  cards?: number[];
  fields: Record<string, { value: string; order: number }>;
};

export type CardInfo = {
  cardId: number;
  note: number;
  deckName: string;
  question: string;
};

export type StoreMediaFileParams =
  | { filename: string; path: string }
  | { filename: string; data: string }
  | { filename: string; url: string };

export type MultiAction = {
  action: string;
  params?: Record<string, unknown>;
};

function buildAddNoteRequest(note: AddNoteParams): Record<string, unknown> {
  return {
    deckName: note.deckName,
    modelName: note.modelName,
    fields: note.fields,
    tags: note.tags,
    options: {
      allowDuplicate: false,
      duplicateScope: "deck",
    },
  };
}

export class AnkiConnectClient {
  private readonly url: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestLimit: ReturnType<typeof pLimit>;
  private readonly retryBaseDelayMs: number;

  constructor(options: AnkiClientOptions) {
    this.url = options.url;
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestLimit = pLimit(
      options.requestConcurrency ?? DEFAULT_INVOKE_CONCURRENCY,
    );
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? INVOKE_RETRY_BASE_MS;
  }

  async invoke<T>(action: string, params?: Record<string, unknown>): Promise<T> {
    return this.requestLimit(async () => {
      let lastError: unknown;

      for (let attempt = 1; attempt <= INVOKE_MAX_ATTEMPTS; attempt += 1) {
        try {
          return await this.invokeOnce<T>(action, params);
        } catch (error) {
          lastError = error;
          if (
            attempt === INVOKE_MAX_ATTEMPTS ||
            !isRetryableAnkiConnectError(error)
          ) {
            throw error;
          }
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              invokeRetryDelayMs(attempt, this.retryBaseDelayMs),
            ),
          );
        }
      }

      throw lastError;
    });
  }

  private async invokeOnce<T>(
    action: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const body: Record<string, unknown> = {
      action,
      version: ANKI_CONNECT_VERSION,
    };

    if (params !== undefined) {
      body.params = params;
    }

    if (this.apiKey) {
      body.key = this.apiKey;
    }

    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new AnkiConnectError(
        `AnkiConnect HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const parsed = AnkiResponseSchema.parse(await response.json());
    if (parsed.error) {
      throw new AnkiConnectError(parsed.error);
    }

    return parsed.result as T;
  }

  async canConnect(): Promise<boolean> {
    try {
      await this.version();
      return true;
    } catch {
      return false;
    }
  }

  async version(): Promise<number> {
    return this.invoke<number>("version");
  }

  async deckNames(): Promise<string[]> {
    return this.invoke<string[]>("deckNames");
  }

  async createDeck(deck: string): Promise<number> {
    return this.invoke<number>("createDeck", { deck });
  }

  async modelNames(): Promise<string[]> {
    return this.invoke<string[]>("modelNames");
  }

  async createModel(params: CreateModelParams): Promise<null> {
    return this.invoke<null>("createModel", {
      modelName: params.modelName,
      inOrderFields: params.inOrderFields,
      cardTemplates: params.cardTemplates,
      ...(params.css !== undefined ? { css: params.css } : {}),
      ...(params.isCloze !== undefined ? { isCloze: params.isCloze } : {}),
    });
  }

  async invokeMulti<T extends unknown[]>(
    actions: MultiAction[],
  ): Promise<T> {
    if (actions.length === 0) {
      return [] as unknown as T;
    }

    return this.invoke<T>("multi", { actions });
  }

  async findNotes(query: string): Promise<number[]> {
    return this.invoke<number[]>("findNotes", { query });
  }

  async notesInfo(noteIds: number[]): Promise<NoteInfo[]> {
    if (noteIds.length === 0) {
      return [];
    }

    return this.invoke<NoteInfo[]>("notesInfo", { notes: noteIds });
  }

  async cardsInfo(cardIds: number[]): Promise<CardInfo[]> {
    if (cardIds.length === 0) {
      return [];
    }

    return this.invoke<CardInfo[]>("cardsInfo", { cards: cardIds });
  }

  async addNote(note: AddNoteParams): Promise<number> {
    return this.invoke<number>("addNote", {
      note: buildAddNoteRequest(note),
    });
  }

  async addNotes(notes: AddNoteParams[]): Promise<Array<number | null>> {
    if (notes.length === 0) {
      return [];
    }

    return this.invoke<Array<number | null>>("addNotes", {
      notes: notes.map((note) => buildAddNoteRequest(note)),
    });
  }

  async updateNoteFields(
    noteId: number,
    fields: Record<string, string>,
  ): Promise<void> {
    await this.invoke<null>("updateNoteFields", {
      note: { id: noteId, fields },
    });
  }

  async updateNoteTags(noteId: number, tags: string[]): Promise<void> {
    await this.invoke<null>("updateNoteTags", {
      note: noteId,
      tags,
    });
  }

  async storeMediaFile(params: StoreMediaFileParams): Promise<string> {
    return this.invoke<string>("storeMediaFile", params);
  }

  async mediaFiles(): Promise<string[]> {
    return this.invoke<string[]>("getMediaFilesNames");
  }

  async deleteNotes(noteIds: number[]): Promise<void> {
    if (noteIds.length === 0) {
      return;
    }

    await this.invoke<null>("deleteNotes", { notes: noteIds });
  }

  async findCards(query: string): Promise<number[]> {
    return this.invoke<number[]>("findCards", { query });
  }

  async suspend(cardIds: number[]): Promise<void> {
    if (cardIds.length === 0) {
      return;
    }

    await this.invoke<boolean>("suspend", { cards: cardIds });
  }
}

export function createAnkiClient(config: Config): AnkiConnectClient {
  return new AnkiConnectClient({
    url: config.ankiConnectUrl,
    apiKey: config.ankiConnectApiKey,
  });
}
