import { describe, expect, test } from "bun:test";
import { AnkiConnectError } from "../../src/anki/client";
import type { AnkiConnectClient } from "../../src/anki/client";
import {
  findNoteByFrontInDeck,
  createSyncRunContext,
  syncFileCards,
} from "../../src/anki/syncEngine";

function createMockClient(overrides: Partial<AnkiConnectClient> = {}): AnkiConnectClient {
  const findNotesImpl =
    overrides.findNotes ?? (async () => [] as number[]);

  return {
    deckNames: async () => ["Test::Deck"],
    findNotes: findNotesImpl,
    invokeMulti:
      overrides.invokeMulti ??
      (async (actions) =>
        Promise.all(
          actions.map(async (action) => {
            if (action.action === "findNotes") {
              return findNotesImpl(action.params?.query as string);
            }
            throw new Error(`unsupported multi action ${action.action}`);
          }),
        )),
    notesInfo: async () => [],
    addNote: async () => 1001,
    addNotes: async (notes) => notes.map(() => 1001),
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

describe("syncEngine batched file sync", () => {
  test("findNoteByFrontInDeck uses targeted deck and front search", async () => {
    let query = "";
    const client = createMockClient({
      findNotes: async (q) => {
        query = q;
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
    });

    const match = await findNoteByFrontInDeck(client, "Test::Deck", "<p>Q</p>");
    expect(query).toBe('deck:"Test::Deck" front:"Q"');
    expect(match?.noteId).toBe(55);
  });

  test("findNoteByFrontInDeck matches when Anki front uses different html wrapper", async () => {
    const client = createMockClient({
      findNotes: async () => [55],
      notesInfo: async () => [
        {
          noteId: 55,
          tags: ["legacy"],
          fields: {
            Front: { value: "<div>Q</div>", order: 0 },
            Back: { value: "<p>A</p>", order: 1 },
          },
        },
      ],
    });

    const match = await findNoteByFrontInDeck(client, "Test::Deck", "<p>Q</p>");
    expect(match?.noteId).toBe(55);
  });

  test("findNoteByFrontInDeck matches when Anki front differs only by code block line endings", async () => {
    const ankiFront =
      '<pre><code class="language-js">// comment\nconst d = ":::";\n</code></pre>';
    const compiledFront =
      '<pre><code class="language-js">// comment\r\nconst d = ":::";\r\n</code></pre>';

    const client = createMockClient({
      findNotes: async () => [55],
      notesInfo: async () => [
        {
          noteId: 55,
          tags: ["legacy"],
          fields: {
            Front: { value: ankiFront, order: 0 },
            Back: { value: "<p>A</p>", order: 1 },
          },
        },
      ],
    });

    const match = await findNoteByFrontInDeck(
      client,
      "Test::Deck",
      compiledFront,
    );
    expect(match?.noteId).toBe(55);
  });

  test("syncFileCards links by front before addNotes when vault id was removed", async () => {
    let addNotesCalls = 0;
    let addNoteCalls = 0;
    const client = createMockClient({
      findNotes: async (query) => {
        if (query.includes('front:"Existing Q"')) {
          return [55];
        }
        return [];
      },
      addNotes: async () => {
        addNotesCalls += 1;
        return [null];
      },
      addNote: async () => {
        addNoteCalls += 1;
        return 999;
      },
      notesInfo: async () => [
        {
          noteId: 55,
          tags: [
            "Obsidian-Anki-AST",
            "CS101::Dup",
            "obsidian-id::existing-uuid",
          ],
          fields: {
            Front: { value: "<p>Existing Q</p>", order: 0 },
            Back: { value: "<p>A</p>", order: 1 },
          },
        },
      ],
    });

    const context = createSyncRunContext(client, baseConfig);
    const fileSync = await syncFileCards(
      client,
      [
        {
          payload: {
            deck: "Test::Deck",
            tag: "CS101::Dup",
            frontHtml: "<p>Existing Q</p>",
            backHtml: "<p>A</p>",
            wouldInjectId: "new-uuid",
          },
        },
      ],
      baseConfig,
      context,
    );

    expect(addNotesCalls).toBe(0);
    expect(addNoteCalls).toBe(0);
    expect(fileSync.results[0]?.action).toBe("skip");
    expect(fileSync.results[0]?.injectedId).toBe("existing-uuid");
    expect(fileSync.results[0]?.ankiNoteId).toBe(55);
  });

  test("syncFileCards with context batches addNotes for new cards", async () => {
    let addNotesCalls = 0;
    let addNoteCalls = 0;
    const client = createMockClient({
      findNotes: async () => [],
      addNotes: async (notes) => {
        addNotesCalls += 1;
        expect(notes).toHaveLength(3);
        return [101, 102, 103];
      },
      addNote: async () => {
        addNoteCalls += 1;
        return 999;
      },
    });

    const context = createSyncRunContext(client, baseConfig);
    const fileSync = await syncFileCards(
      client,
      [
        {
          payload: {
            deck: "Test::Deck",
            tag: "CS101::One",
            frontHtml: "<p>One</p>",
            backHtml: "<p>A</p>",
            wouldInjectId: "uuid-1",
          },
        },
        {
          payload: {
            deck: "Test::Deck",
            tag: "CS101::Two",
            frontHtml: "<p>Two</p>",
            backHtml: "<p>B</p>",
            wouldInjectId: "uuid-2",
          },
        },
        {
          payload: {
            deck: "Test::Deck",
            tag: "CS101::Three",
            frontHtml: "<p>Three</p>",
            backHtml: "<p>C</p>",
            wouldInjectId: "uuid-3",
          },
        },
      ],
      baseConfig,
      context,
    );

    expect(addNotesCalls).toBe(1);
    expect(addNoteCalls).toBe(0);
    expect(fileSync.results.map((r) => r.ankiNoteId)).toEqual([101, 102, 103]);
  });

  test("syncFileCards with context prefetches note ids via invokeMulti", async () => {
    let multiCalls = 0;
    const client = createMockClient({
      invokeMulti: async (actions) => {
        multiCalls += 1;
        expect(actions).toHaveLength(2);
        return [[99], []];
      },
      notesInfo: async (ids) => [
        {
          noteId: ids[0]!,
          tags: [
            "Obsidian-Anki-AST",
            "CS101::Entropy",
            "obsidian-id::existing-uuid",
          ],
          fields: {
            Front: { value: "<p>Old</p>", order: 0 },
            Back: { value: "<p>Old back</p>", order: 1 },
          },
        },
      ],
    });

    const context = createSyncRunContext(client, baseConfig);
    const fileSync = await syncFileCards(
      client,
      [
        {
          payload: {
            deck: "Test::Deck",
            tag: "CS101::Entropy",
            frontHtml: "<p>New</p>",
            backHtml: "<p>New back</p>",
            ankiId: "existing-uuid",
          },
        },
        {
          payload: {
            deck: "Test::Deck",
            tag: "CS101::Two",
            frontHtml: "<p>Fresh</p>",
            backHtml: "<p>B</p>",
            wouldInjectId: "new-uuid",
          },
        },
      ],
      baseConfig,
      context,
    );

    expect(multiCalls).toBe(1);
    expect(fileSync.results[0]?.action).toBe("update");
    expect(fileSync.results[1]?.action).toBe("add");
  });

  test("syncFileCards recovers null addNotes slots individually", async () => {
    const client = createMockClient({
      findNotes: async (query) => {
        if (query.includes('front:"Duplicate Q"')) {
          return [55];
        }
        return [];
      },
      addNotes: async () => [null],
      notesInfo: async () => [
        {
          noteId: 55,
          tags: ["legacy"],
          fields: {
            Front: { value: "<p>Duplicate Q</p>", order: 0 },
            Back: { value: "<p>A</p>", order: 1 },
          },
        },
      ],
      updateNoteTags: async () => undefined,
    });

    const context = createSyncRunContext(client, baseConfig);
    const fileSync = await syncFileCards(
      client,
      [
        {
          payload: {
            deck: "Test::Deck",
            tag: "CS101::Dup",
            frontHtml: "<p>Duplicate Q</p>",
            backHtml: "<p>A</p>",
            wouldInjectId: "new-uuid",
          },
        },
      ],
      baseConfig,
      context,
    );

    expect(fileSync.results[0]?.action).toBe("update");
    expect(fileSync.results[0]?.injectedId).toBe("new-uuid");
    expect(fileSync.results[0]?.duplicateWarning?.kind).toBe(
      "anki_duplicate_recovered",
    );
  });

  test("syncFileCards falls back to addNote when addNotes throws", async () => {
    let addNoteCalls = 0;
    const client = createMockClient({
      findNotes: async () => [],
      addNotes: async () => {
        throw new AnkiConnectError("batch rejected");
      },
      addNote: async () => {
        addNoteCalls += 1;
        return 501;
      },
    });

    const context = createSyncRunContext(client, baseConfig);
    const fileSync = await syncFileCards(
      client,
      [
        {
          payload: {
            deck: "Test::Deck",
            tag: "CS101::One",
            frontHtml: "<p>One</p>",
            backHtml: "<p>A</p>",
            wouldInjectId: "uuid-1",
          },
        },
      ],
      baseConfig,
      context,
    );

    expect(addNoteCalls).toBe(1);
    expect(fileSync.results[0]?.ankiNoteId).toBe(501);
  });
});
