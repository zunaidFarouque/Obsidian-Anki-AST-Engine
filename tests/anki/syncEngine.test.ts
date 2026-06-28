import { describe, expect, test } from "bun:test";
import type { AnkiConnectClient } from "../../src/anki/client";
import {
  buildAnkiTags,
  buildObsidianIdTag,
  syncCard,
  type CardSyncPayload,
} from "../../src/anki/syncEngine";

function createMockClient(overrides: Partial<AnkiConnectClient> = {}): AnkiConnectClient {
  return {
    deckNames: async () => ["Test::Deck"],
    findNotes: async () => [],
    notesInfo: async () => [],
    addNote: async () => 1001,
    updateNoteFields: async () => undefined,
    updateNoteTags: async () => undefined,
    ...overrides,
  } as unknown as AnkiConnectClient;
}

const baseConfig = {
  noteModelName: "Basic",
  syncTagPrefix: "obsidian-id",
};

describe("syncEngine", () => {
  test("buildObsidianIdTag namespaces uuid", () => {
    expect(buildObsidianIdTag("obsidian-id", "abc-123")).toBe(
      "obsidian-id::abc-123",
    );
  });

  test("buildAnkiTags includes heading and obsidian id", () => {
    expect(buildAnkiTags("CS101::Entropy", "obsidian-id", "uuid-1")).toEqual([
      "CS101::Entropy",
      "obsidian-id::uuid-1",
    ]);
  });

  test("syncCard adds note when no ankiId", async () => {
    let addedTags: string[] = [];
    const client = createMockClient({
      addNote: async (note) => {
        addedTags = note.tags;
        return 42;
      },
    });

    const payload: CardSyncPayload = {
      deck: "Test::Deck",
      tag: "CS101::Entropy",
      frontHtml: "<p>Q</p>",
      backHtml: "<p>A</p>",
      wouldInjectId: "new-uuid",
    };

    const result = await syncCard(client, payload, baseConfig);
    expect(result.action).toBe("add");
    expect(result.ankiNoteId).toBe(42);
    expect(addedTags).toContain("CS101::Entropy");
    expect(addedTags).toContain("obsidian-id::new-uuid");
  });

  test("syncCard updates fields when content differs", async () => {
    let updatedFields: Record<string, string> | undefined;
    const client = createMockClient({
      findNotes: async () => [99],
      notesInfo: async () => [
        {
          noteId: 99,
          tags: ["CS101::Entropy", "obsidian-id::existing-uuid"],
          fields: {
            Front: { value: "<p>Old</p>", order: 0 },
            Back: { value: "<p>Old back</p>", order: 1 },
          },
        },
      ],
      updateNoteFields: async (_id, fields) => {
        updatedFields = fields;
      },
    });

    const result = await syncCard(
      client,
      {
        deck: "Test::Deck",
        tag: "CS101::Entropy",
        frontHtml: "<p>New</p>",
        backHtml: "<p>New back</p>",
        ankiId: "existing-uuid",
      },
      baseConfig,
    );

    expect(result.action).toBe("update");
    expect(updatedFields).toEqual({
      Front: "<p>New</p>",
      Back: "<p>New back</p>",
    });
  });

  test("syncCard skips update when fields unchanged", async () => {
    let updateCalled = false;
    const client = createMockClient({
      findNotes: async () => [99],
      notesInfo: async () => [
        {
          noteId: 99,
          tags: ["CS101::Entropy", "obsidian-id::existing-uuid"],
          fields: {
            Front: { value: "<p>Same</p>", order: 0 },
            Back: { value: "<p>Same back</p>", order: 1 },
          },
        },
      ],
      updateNoteFields: async () => {
        updateCalled = true;
      },
    });

    const result = await syncCard(
      client,
      {
        deck: "Test::Deck",
        tag: "CS101::Entropy",
        frontHtml: "<p>Same</p>",
        backHtml: "<p>Same back</p>",
        ankiId: "existing-uuid",
      },
      baseConfig,
    );

    expect(result.action).toBe("skip");
    expect(updateCalled).toBe(false);
  });

  test("syncCard re-adds orphan uuid not found in Anki", async () => {
    const client = createMockClient({
      findNotes: async () => [],
      addNote: async () => 77,
    });

    const result = await syncCard(
      client,
      {
        deck: "Test::Deck",
        tag: "CS101::Entropy",
        frontHtml: "<p>Q</p>",
        backHtml: "<p>A</p>",
        ankiId: "orphan-uuid",
      },
      baseConfig,
    );

    expect(result.action).toBe("add");
    expect(result.ankiNoteId).toBe(77);
  });
});
