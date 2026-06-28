import type { AnkiConnectClient } from "./client";

export type DeckEnsurer = {
  ensureDeck(deckName: string): Promise<void>;
};

export function createDeckEnsurer(
  client: AnkiConnectClient,
  autoCreateDecks: boolean,
): DeckEnsurer {
  let knownDecks: Set<string> | undefined;
  let loadingDecks: Promise<Set<string>> | undefined;
  const creatingByName = new Map<string, Promise<void>>();

  async function loadDecks(): Promise<Set<string>> {
    if (knownDecks !== undefined) {
      return knownDecks;
    }

    if (loadingDecks === undefined) {
      loadingDecks = client.deckNames().then((names) => {
        knownDecks = new Set(names);
        return knownDecks;
      });
    }

    return loadingDecks;
  }

  async function ensureDeck(deckName: string): Promise<void> {
    const decks = await loadDecks();
    if (decks.has(deckName)) {
      return;
    }

    if (!autoCreateDecks) {
      throw new Error(`Anki deck not found: ${deckName}`);
    }

    const inFlight = creatingByName.get(deckName);
    if (inFlight) {
      await inFlight;
      return;
    }

    const createPromise = (async () => {
      await client.createDeck(deckName);
      decks.add(deckName);
    })();

    creatingByName.set(deckName, createPromise);
    try {
      await createPromise;
    } finally {
      creatingByName.delete(deckName);
    }
  }

  return { ensureDeck };
}
