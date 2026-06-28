import { describe, expect, test } from "bun:test";
import type { AnkiConnectClient } from "../../src/anki/client";
import {
  buildFrontDuplicateSearchQuery,
  buildFrontOnlySearchQuery,
  findNoteByFrontInDeck,
  frontsMatchForRecovery,
  stripHtmlForSearch,
} from "../../src/anki/frontSearch";

describe("frontSearch", () => {
  test("stripHtmlForSearch removes tags and collapses whitespace", () => {
    expect(stripHtmlForSearch("<p>What is <strong>TCP</strong>?</p>")).toBe(
      "What is TCP ?",
    );
  });

  test("buildFrontDuplicateSearchQuery scopes to deck and front field", () => {
    expect(
      buildFrontDuplicateSearchQuery(
        "Synced from Obsidian",
        "<p>What is TCP?</p>",
      ),
    ).toBe('deck:"Synced from Obsidian" front:"What is TCP?"');
  });

  test("buildFrontDuplicateSearchQuery escapes quotes in deck and text", () => {
    expect(
      buildFrontDuplicateSearchQuery('Deck "A"', '<p>Say "hi"</p>'),
    ).toBe('deck:"Deck \\"A\\"" front:"Say \\"hi\\""');
  });

  test("buildFrontDuplicateSearchQuery uses media src when front has no plain text", () => {
    expect(
      buildFrontDuplicateSearchQuery(
        "Synced from Obsidian",
        '<p><img src="diagram.png" alt="diagram"></p>',
      ),
    ).toBe('deck:"Synced from Obsidian" front:"diagram.png"');
  });

  test("frontsMatchForRecovery matches different html wrappers with same plain text", () => {
    expect(
      frontsMatchForRecovery(
        "<div>Same question</div>",
        "<p>Same question</p>",
      ),
    ).toBe(true);
  });

  test("frontsMatchForRecovery matches image-only fronts by src", () => {
    expect(
      frontsMatchForRecovery(
        '<p><img src="diagram.png" alt=""></p>',
        '<img src="diagram.png" alt="diagram">',
      ),
    ).toBe(true);
  });

  test("frontsMatchForRecovery matches different letter casing with same plain text", () => {
    expect(
      frontsMatchForRecovery(
        "<p>Do you have any fear of returning to Bangladesh?</p>",
        "<p>Do You Have Any Fear of Returning to Bangladesh?</p>",
      ),
    ).toBe(true);
  });

  test("findNoteByFrontInDeck matches when Anki front uses different letter casing", async () => {
    const client = {
      findNotes: async (query: string) => {
        if (query.includes("fear of returning")) {
          return [88];
        }
        return [];
      },
      notesInfo: async () => [
        {
          noteId: 88,
          tags: ["obsidian-id::existing-uuid"],
          fields: {
            Front: {
              value: "<p>Do you have any fear of returning to Bangladesh?</p>",
              order: 0,
            },
            Back: { value: "<p>A</p>", order: 1 },
          },
        },
      ],
    } as unknown as AnkiConnectClient;

    const match = await findNoteByFrontInDeck(
      client,
      "VISA",
      "<p>Do You Have Any Fear of Returning to Bangladesh?</p>",
    );

    expect(match?.noteId).toBe(88);
  });

  test("findNoteByFrontInDeck falls back to collection-wide front search", async () => {
    const queries: string[] = [];
    const client = {
      findNotes: async (query: string) => {
        queries.push(query);
        if (query.startsWith('deck:"Test::Deck"')) {
          return [];
        }
        if (query.startsWith('front:"Shared Q"') || query === 'front:"shared q"') {
          return [77];
        }
        return [];
      },
      notesInfo: async () => [
        {
          noteId: 77,
          tags: ["obsidian-id::existing-uuid"],
          fields: {
            Front: { value: "<div>Shared Q</div>", order: 0 },
            Back: { value: "<p>A</p>", order: 1 },
          },
        },
      ],
    } as unknown as AnkiConnectClient;

    const match = await findNoteByFrontInDeck(
      client,
      "Test::Deck",
      "<p>Shared Q</p>",
    );

    expect(queries).toEqual([
      'deck:"Test::Deck" front:"Shared Q"',
      'front:"Shared Q"',
    ]);
    expect(match?.noteId).toBe(77);
  });

  test("buildFrontOnlySearchQuery returns media token when plain text is empty", () => {
    expect(
      buildFrontOnlySearchQuery('<img src="chart.jpg" alt="">'),
    ).toBe('front:"chart.jpg"');
  });
});
