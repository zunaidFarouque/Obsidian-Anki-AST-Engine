import { z } from "zod";
import type { Config } from "../config/configParser";

const ANKI_CONNECT_VERSION = 6;

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
};

export type AddNoteParams = {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
};

export type NoteInfo = {
  noteId: number;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
};

export class AnkiConnectClient {
  private readonly url: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnkiClientOptions) {
    this.url = options.url;
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async invoke<T>(action: string, params?: Record<string, unknown>): Promise<T> {
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

  async findNotes(query: string): Promise<number[]> {
    return this.invoke<number[]>("findNotes", { query });
  }

  async notesInfo(noteIds: number[]): Promise<NoteInfo[]> {
    if (noteIds.length === 0) {
      return [];
    }

    return this.invoke<NoteInfo[]>("notesInfo", { notes: noteIds });
  }

  async addNote(note: AddNoteParams): Promise<number> {
    return this.invoke<number>("addNote", {
      note: {
        deckName: note.deckName,
        modelName: note.modelName,
        fields: note.fields,
        tags: note.tags,
        options: {
          allowDuplicate: false,
          duplicateScope: "deck",
        },
      },
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

  async storeMediaFile(filename: string, data: string): Promise<string> {
    return this.invoke<string>("storeMediaFile", {
      filename,
      data,
    });
  }

  async mediaFiles(): Promise<string[]> {
    return this.invoke<string[]>("getMediaFilesNames");
  }
}

export function createAnkiClient(config: Config): AnkiConnectClient {
  return new AnkiConnectClient({
    url: config.ankiConnectUrl,
    apiKey: config.ankiConnectApiKey,
  });
}
