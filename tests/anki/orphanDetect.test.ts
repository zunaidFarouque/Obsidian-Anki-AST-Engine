import { describe, expect, mock, test } from "bun:test";
import type { Config } from "../../src/config/configParser";
import { detectVaultOrphans } from "../../src/anki/orphanDetect";
import type { AnkiConnectClient } from "../../src/anki/client";

const baseConfig: Pick<
  Config,
  "defaultEngineTag" | "syncTagPrefix" | "noteModelName" | "noteModelType"
> = {
  defaultEngineTag: "Obsidian-Anki-AST",
  syncTagPrefix: "obsidian-id",
  noteModelName: "Basic",
  noteModelType: "basic",
};

function mockClient(handlers: {
  findNotes?: (query: string) => Promise<number[]>;
  notesInfo?: (noteIds: number[]) => Promise<
    Array<{ noteId: number; tags: string[]; fields: Record<string, unknown> }>
  >;
}): AnkiConnectClient {
  return {
    findNotes: mock(handlers.findNotes ?? (async () => [])),
    notesInfo: mock(handlers.notesInfo ?? (async () => [])),
  } as unknown as AnkiConnectClient;
}

describe("detectVaultOrphans", () => {
  test("returns notes with engine tag whose UUID is absent from vault scan", async () => {
    const client = mockClient({
      findNotes: async (query) => {
        expect(query).toBe('tag:"Obsidian-Anki-AST"');
        return [101, 102, 103];
      },
      notesInfo: async (noteIds) => {
        expect(noteIds).toEqual([101, 102, 103]);
        return [
          {
            noteId: 101,
            tags: ["Obsidian-Anki-AST", "obsidian-id::vault-uuid-1"],
            fields: {},
          },
          {
            noteId: 102,
            tags: ["Obsidian-Anki-AST", "obsidian-id::orphan-uuid"],
            fields: {},
          },
          {
            noteId: 103,
            tags: ["Obsidian-Anki-AST"],
            fields: {},
          },
        ];
      },
    });

    const orphans = await detectVaultOrphans({
      client,
      config: {
        vaultPath: "/vault",
        delimiter: ":::",
        scanFolders: ["."],
        defaultAnkiDeck: "Default",
        ...baseConfig,
      },
      vaultBoundUuids: new Set(["vault-uuid-1"]),
    });

    expect(orphans).toEqual([
      {
        ankiNoteId: 102,
        uuid: "orphan-uuid",
        tags: ["Obsidian-Anki-AST", "obsidian-id::orphan-uuid"],
      },
    ]);
  });
});
