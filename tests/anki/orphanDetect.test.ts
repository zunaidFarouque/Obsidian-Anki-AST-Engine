import { describe, expect, mock, test } from "bun:test";
import type { Config } from "../../src/config/configParser";
import { detectVaultOrphans } from "../../src/anki/orphanDetect";
import type { AnkiConnectClient } from "../../src/anki/client";

const baseConfig: Pick<
  Config,
  | "defaultEngineTag"
  | "syncTagPrefix"
  | "noteModelName"
  | "noteModelType"
  | "orphanIgnoreTag"
> = {
  defaultEngineTag: "Obsidian-Anki-AST",
  syncTagPrefix: "obsidian-id",
  noteModelName: "Basic",
  noteModelType: "basic",
  orphanIgnoreTag: "obsidian-sync-ignore",
};

function mockClient(handlers: {
  findNotes?: (query: string) => Promise<number[]>;
  notesInfo?: (noteIds: number[]) => Promise<
    Array<{
      noteId: number;
      tags: string[];
      cards?: number[];
      fields: Record<string, { value: string; order: number }>;
    }>
  >;
  cardsInfo?: (cardIds: number[]) => Promise<
    Array<{
      cardId: number;
      note: number;
      deckName: string;
      question: string;
    }>
  >;
}): AnkiConnectClient {
  return {
    findNotes: mock(handlers.findNotes ?? (async () => [])),
    notesInfo: mock(handlers.notesInfo ?? (async () => [])),
    cardsInfo: mock(handlers.cardsInfo ?? (async () => [])),
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
            cards: [1001],
            fields: {
              Front: { value: "In-vault card", order: 0 },
              Back: { value: "Answer", order: 1 },
            },
          },
          {
            noteId: 102,
            tags: ["Obsidian-Anki-AST", "obsidian-id::orphan-uuid"],
            cards: [1002],
            fields: {
              Front: { value: "<p>Orphan front preview</p>", order: 0 },
              Back: { value: "Orphan back", order: 1 },
            },
          },
          {
            noteId: 103,
            tags: ["Obsidian-Anki-AST"],
            cards: [1003],
            fields: {
              Front: { value: "No UUID", order: 0 },
            },
          },
        ];
      },
      cardsInfo: async (cardIds) => {
        expect(cardIds).toEqual([1002]);
        return [
          {
            cardId: 1002,
            note: 102,
            deckName: "Science::Orphans",
            question: "<p>Orphan front preview</p>",
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
        deck: "Science::Orphans",
        preview: "Orphan front preview",
        tags: ["Obsidian-Anki-AST", "obsidian-id::orphan-uuid"],
      },
    ]);
  });

  test("prefers note Front field over cardsInfo question with card css", async () => {
    const client = mockClient({
      findNotes: async () => [102],
      notesInfo: async () => [
        {
          noteId: 102,
          tags: ["Obsidian-Anki-AST", "obsidian-id::orphan-uuid"],
          cards: [1002],
          fields: {
            Front: { value: "<p>What is a visa?</p>", order: 0 },
            Back: { value: "Answer", order: 1 },
          },
        },
      ],
      cardsInfo: async () => [
        {
          cardId: 1002,
          note: 102,
          deckName: "VISA",
          question:
            "<style>.card { font-family: arial; font-size: 20px; }</style><div>What is a visa?</div>",
        },
      ],
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
      vaultBoundUuids: new Set(),
    });

    expect(orphans[0]?.preview).toBe("What is a visa?");
    expect(orphans[0]?.deck).toBe("VISA");
  });

  test("skips notes that already have the orphan ignore tag", async () => {
    const client = mockClient({
      findNotes: async () => [102, 103],
      notesInfo: async () => [
        {
          noteId: 102,
          tags: [
            "Obsidian-Anki-AST",
            "obsidian-id::orphan-uuid",
            "obsidian-sync-ignore",
          ],
          cards: [1002],
          fields: {
            Front: { value: "Ignored orphan", order: 0 },
          },
        },
        {
          noteId: 103,
          tags: ["Obsidian-Anki-AST", "obsidian-id::active-orphan"],
          cards: [1003],
          fields: {
            Front: { value: "Active orphan", order: 0 },
          },
        },
      ],
      cardsInfo: async () => [
        {
          cardId: 1003,
          note: 103,
          deckName: "VISA",
          question: "<p>Active orphan</p>",
        },
      ],
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
      vaultBoundUuids: new Set(),
    });

    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.ankiNoteId).toBe(103);
    expect(orphans[0]?.uuid).toBe("active-orphan");
  });
});
