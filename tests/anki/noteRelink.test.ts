import { describe, expect, test } from "bun:test";
import type { AnkiConnectClient } from "../../src/anki/client";
import { resolveExistingNoteForRelink } from "../../src/anki/noteRelink";

function createMockClient(overrides: Partial<AnkiConnectClient> = {}): AnkiConnectClient {
  const findNotesImpl =
    overrides.findNotes ?? (async () => [] as number[]);

  return {
    deckNames: async () => ["VISA"],
    findNotes: findNotesImpl,
    notesInfo: async () => [],
    ...overrides,
  } as unknown as AnkiConnectClient;
}

describe("noteRelink", () => {
  test("resolveExistingNoteForRelink finds Why Expedite card by heading tag when front search misses", async () => {
    const queries: string[] = [];
    const client = createMockClient({
      findNotes: async (query) => {
        queries.push(query);
        if (query.includes("Why_Expedite")) {
          return [42];
        }
        if (query.startsWith('deck:"VISA" front:"')) {
          return [];
        }
        return [];
      },
      notesInfo: async () => [
        {
          noteId: 42,
          tags: [
            "Obsidian-Anki-AST",
            "VISAF1",
            "General_Questions::Why_Expedite?",
            "obsidian-id::8acaff39-f843-4b76-99de-088a24039dac",
          ],
          fields: {
            Front: {
              value:
                '<p>VO: <em>"Why are you here today instead of your original July appointment? Why couldn\'t you wait?"</em></p>',
              order: 0,
            },
            Back: { value: "<p>Answer</p>", order: 1 },
          },
        },
      ],
    });

    const match = await resolveExistingNoteForRelink(client, {
      deck: "VISA",
      tag: "General Questions::Why Expedite?",
      frontHtml:
        '<p>VO: <em>"Why are you here today instead of your original July appointment? Why couldn\'t you wait?"</em></p>',
    });

    expect(match?.noteId).toBe(42);
    expect(queries.some((query) => query.includes("Why_Expedite"))).toBe(true);
  });

  test("resolveExistingNoteForRelink finds Bangladesh card by front with case drift", async () => {
    const client = createMockClient({
      findNotes: async (query) => {
        if (query.includes("fear of returning")) {
          return [88];
        }
        return [];
      },
      notesInfo: async () => [
        {
          noteId: 88,
          tags: ["obsidian-id::1a490adf-c248-4009-a32f-92501eeb5b35"],
          fields: {
            Front: {
              value: "<p>Do you have any fear of returning to Bangladesh?</p>",
              order: 0,
            },
            Back: { value: "<p>No</p>", order: 1 },
          },
        },
      ],
    });

    const match = await resolveExistingNoteForRelink(client, {
      deck: "VISA",
      tag: "General Questions::Follow-up Questions::Do You Have Any Fear of Returning to Bangladesh?",
      frontHtml: "<p>Do You Have Any Fear of Returning to Bangladesh?</p>",
    });

    expect(match?.noteId).toBe(88);
  });
});
