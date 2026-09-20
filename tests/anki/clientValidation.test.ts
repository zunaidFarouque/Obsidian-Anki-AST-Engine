import { describe, expect, it } from "bun:test";
import {
  AnkiConnectClient,
  AnkiConnectError,
  isRetryableAnkiConnectError,
} from "../../src/anki/client";

describe("AnkiConnectClient validation & error handling without Zod", () => {
  it("unwraps valid response result correctly", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ result: ["Deck1", "Deck2"], error: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const client = new AnkiConnectClient({
      url: "http://127.0.0.1:8765",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const decks = await client.deckNames();
    expect(decks).toEqual(["Deck1", "Deck2"]);
  });

  it("throws AnkiConnectError with server error message", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({ result: null, error: "model 'Basic' not found" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

    const client = new AnkiConnectClient({
      url: "http://127.0.0.1:8765",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(client.deckNames()).rejects.toThrow(
      new AnkiConnectError("model 'Basic' not found"),
    );
  });

  it("throws AnkiConnectError on malformed response structure", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ unexpected: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const client = new AnkiConnectClient({
      url: "http://127.0.0.1:8765",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(client.deckNames()).rejects.toThrow(
      new AnkiConnectError("Malformed response from AnkiConnect"),
    );
  });

  it("correctly identifies retryable network errors", () => {
    expect(isRetryableAnkiConnectError(new TypeError("Failed to fetch"))).toBe(true);
    expect(
      isRetryableAnkiConnectError(
        new AnkiConnectError("Unable to connect to AnkiConnect"),
      ),
    ).toBe(true);
    expect(
      isRetryableAnkiConnectError(new AnkiConnectError("deck 'Unknown' not found")),
    ).toBe(false);
  });
});
