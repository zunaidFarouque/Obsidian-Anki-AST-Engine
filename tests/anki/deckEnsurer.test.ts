import { describe, expect, test } from "bun:test";
import type { AnkiConnectClient } from "../../src/anki/client";
import { createDeckEnsurer } from "../../src/anki/deckEnsurer";

function createMockClient(overrides: Partial<AnkiConnectClient> = {}): AnkiConnectClient {
  return {
    deckNames: async () => ["Test::Deck"],
    createDeck: async () => 1,
    ...overrides,
  } as unknown as AnkiConnectClient;
}

describe("deckEnsurer", () => {
  test("deckNames is called once across multiple ensureDeck calls for existing deck", async () => {
    let deckNamesCalls = 0;
    const client = createMockClient({
      deckNames: async () => {
        deckNamesCalls += 1;
        return ["Test::Deck"];
      },
    });

    const ensurer = createDeckEnsurer(client, true);
    await Promise.all([
      ensurer.ensureDeck("Test::Deck"),
      ensurer.ensureDeck("Test::Deck"),
      ensurer.ensureDeck("Test::Deck"),
      ensurer.ensureDeck("Test::Deck"),
      ensurer.ensureDeck("Test::Deck"),
    ]);

    expect(deckNamesCalls).toBe(1);
  });

  test("parallel ensureDeck for missing deck calls createDeck once", async () => {
    let createDeckCalls = 0;
    const client = createMockClient({
      deckNames: async () => ["Test::Deck"],
      createDeck: async () => {
        createDeckCalls += 1;
        return 2;
      },
    });

    const ensurer = createDeckEnsurer(client, true);
    await Promise.all([
      ensurer.ensureDeck("New::Deck"),
      ensurer.ensureDeck("New::Deck"),
    ]);

    expect(createDeckCalls).toBe(1);
  });

  test("throws when deck missing and autoCreateDecks is false", async () => {
    const client = createMockClient({
      deckNames: async () => ["Test::Deck"],
    });

    const ensurer = createDeckEnsurer(client, false);
    await expect(ensurer.ensureDeck("Missing::Deck")).rejects.toThrow(
      "Anki deck not found: Missing::Deck",
    );
  });
});
