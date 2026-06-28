import { describe, expect, test } from "bun:test";
import { AnkiConnectError } from "../../src/anki/client";
import type { AnkiConnectClient } from "../../src/anki/client";
import {
  buildAnkiTags,
  buildObsidianIdTag,
  syncCard,
  syncFileCards,
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
  defaultEngineTag: "Obsidian-Anki-AST",
  autoCreateDecks: true,
};

const fullTags = [
  "Obsidian-Anki-AST",
  "CS101::Entropy",
  "obsidian-id::new-uuid",
];

describe("syncEngine", () => {
  test("buildObsidianIdTag namespaces uuid", () => {
    expect(buildObsidianIdTag("obsidian-id", "abc-123")).toBe(
      "obsidian-id::abc-123",
    );
  });

  test("buildAnkiTags includes engine, file, heading, and obsidian id tags", () => {
    expect(
      buildAnkiTags({
        engineTag: "Obsidian-Anki-AST",
        fileTags: ["exam-prep"],
        headingTag: "Feature Stress Test::Entropy",
        syncTagPrefix: "obsidian-id",
        uuid: "uuid-1",
      }),
    ).toEqual([
      "Obsidian-Anki-AST",
      "exam-prep",
      "Feature_Stress_Test::Entropy",
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
    expect(addedTags).toEqual(fullTags);
  });

  test("syncCard updates fields when content differs", async () => {
    let updatedFields: Record<string, string> | undefined;
    const client = createMockClient({
      findNotes: async () => [99],
      notesInfo: async () => [
        {
          noteId: 99,
          tags: fullTags,
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

  test("syncCard skips update when fields and tags unchanged", async () => {
    let updateCalled = false;
    const client = createMockClient({
      findNotes: async () => [99],
      notesInfo: async () => [
        {
          noteId: 99,
          tags: fullTags.map((tag) =>
            tag === "obsidian-id::new-uuid"
              ? "obsidian-id::existing-uuid"
              : tag,
          ),
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

  test("syncCard recovers duplicate by linking existing note and injecting id", async () => {
    let updatedTags: string[] | undefined;
    const client = createMockClient({
      findNotes: async (query) => {
        if (query.includes('tag:"obsidian-id::')) {
          return [];
        }
        return [55];
      },
      notesInfo: async () => [
        {
          noteId: 55,
          tags: ["legacy"],
          fields: {
            Front: { value: "<p>Q</p>", order: 0 },
            Back: { value: "<p>A</p>", order: 1 },
          },
        },
      ],
      addNote: async () => {
        throw new AnkiConnectError("cannot create note because it is a duplicate");
      },
      updateNoteTags: async (_id, tags) => {
        updatedTags = tags;
      },
    });

    const result = await syncCard(
      client,
      {
        deck: "Test::Deck",
        tag: "CS101::Entropy",
        frontHtml: "<p>Q</p>",
        backHtml: "<p>A</p>",
        wouldInjectId: "new-uuid",
      },
      baseConfig,
    );

    expect(result.action).toBe("update");
    expect(result.ankiNoteId).toBe(55);
    expect(result.injectedId).toBe("new-uuid");
    expect(updatedTags).toContain("obsidian-id::new-uuid");
    expect(result.duplicateWarning?.kind).toBe("anki_duplicate_recovered");
    expect(result.duplicateWarning?.ankiNoteId).toBe(55);
    expect(result.duplicateWarning?.message).toContain("duplicate Front");
  });

  test("syncCard duplicate recovery reuses existing obsidian-id tag for injection", async () => {
    const client = createMockClient({
      findNotes: async (query) => {
        if (query.includes('tag:"obsidian-id::')) {
          return [];
        }
        return [55];
      },
      notesInfo: async () => [
        {
          noteId: 55,
          tags: fullTags.map((tag) =>
            tag === "obsidian-id::new-uuid"
              ? "obsidian-id::existing-uuid"
              : tag,
          ),
          fields: {
            Front: { value: "<p>Q</p>", order: 0 },
            Back: { value: "<p>A</p>", order: 1 },
          },
        },
      ],
      addNote: async () => {
        throw new AnkiConnectError("cannot create note because it is a duplicate");
      },
    });

    const result = await syncCard(
      client,
      {
        deck: "Test::Deck",
        tag: "CS101::Entropy",
        frontHtml: "<p>Q</p>",
        backHtml: "<p>A</p>",
        wouldInjectId: "new-uuid",
      },
      baseConfig,
    );

    expect(result.injectedId).toBe("existing-uuid");
  });

  test("syncCard skips update when only code block line endings differ", async () => {
    let updateCalled = false;
    const ankiBack =
      '<pre><code class="language-js">// comment\nconst d = ":::";\n</code></pre>';
    const compiledBack =
      '<pre><code class="language-js">// comment\r\nconst d = ":::";\r\n</code></pre>';

    const client = createMockClient({
      findNotes: async () => [99],
      notesInfo: async () => [
        {
          noteId: 99,
          tags: fullTags.map((tag) =>
            tag === "obsidian-id::new-uuid"
              ? "obsidian-id::existing-uuid"
              : tag,
          ),
          fields: {
            Front: { value: "<p>Same</p>", order: 0 },
            Back: { value: ankiBack, order: 1 },
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
        backHtml: compiledBack,
        ankiId: "existing-uuid",
      },
      baseConfig,
    );

    expect(result.action).toBe("skip");
    expect(updateCalled).toBe(false);
  });

  test("syncCard sends LF-normalized code block content when fields truly change", async () => {
    let updatedFields: Record<string, string> | undefined;
    const compiledBack =
      '<pre><code class="language-js">// comment\r\nconst d = ":::";\r\n</code></pre>';

    const client = createMockClient({
      findNotes: async () => [99],
      notesInfo: async () => [
        {
          noteId: 99,
          tags: fullTags.map((tag) =>
            tag === "obsidian-id::new-uuid"
              ? "obsidian-id::existing-uuid"
              : tag,
          ),
          fields: {
            Front: { value: "<p>Same</p>", order: 0 },
            Back: { value: "<p>Old back</p>", order: 1 },
          },
        },
      ],
      updateNoteFields: async (_id, fields) => {
        updatedFields = fields;
      },
    });

    await syncCard(
      client,
      {
        deck: "Test::Deck",
        tag: "CS101::Entropy",
        frontHtml: "<p>Same</p>",
        backHtml: compiledBack,
        ankiId: "existing-uuid",
      },
      baseConfig,
    );

    expect(updatedFields?.Back).toBe(
      '<pre><code class="language-js">// comment\nconst d = ":::";\n</code></pre>',
    );
  });

  test("syncFileCards collects injections when later card fails", async () => {
    const client = createMockClient({
      addNote: async (note) => {
        if (note.fields.Front === "<p>Fail</p>") {
          throw new Error("boom");
        }
        return 101;
      },
    });

    const fileSync = await syncFileCards(
      client,
      [
        {
          payload: {
            deck: "Test::Deck",
            tag: "CS101::One",
            frontHtml: "<p>Ok</p>",
            backHtml: "<p>A</p>",
            wouldInjectId: "uuid-1",
          },
          injectionOffset: 100,
        },
        {
          payload: {
            deck: "Test::Deck",
            tag: "CS101::Two",
            frontHtml: "<p>Fail</p>",
            backHtml: "<p>B</p>",
            wouldInjectId: "uuid-2",
          },
          injectionOffset: 200,
        },
      ],
      baseConfig,
    );

    expect(fileSync.results[0]?.action).toBe("add");
    expect(fileSync.results[0]?.injectedId).toBe("uuid-1");
    expect(fileSync.results[1]?.error).toContain("boom");
    expect(fileSync.injections).toEqual([{ offset: 100, uuid: "uuid-1" }]);
  });
});
