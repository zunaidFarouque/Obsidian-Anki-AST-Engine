import { describe, expect, mock, test } from "bun:test";
import { AnkiConnectClient } from "../../src/anki/client";

describe("AnkiConnectClient batch APIs", () => {
  test("addNotes sends duplicate options for each note", async () => {
    const fetchImpl = mock(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.action).toBe("addNotes");
      expect(body.params.notes).toHaveLength(2);
      expect(body.params.notes[0].options).toEqual({
        allowDuplicate: false,
        duplicateScope: "deck",
      });
      return new Response(
        JSON.stringify({ result: [1001, 1002], error: null }),
      );
    });

    const client = new AnkiConnectClient({
      url: "http://127.0.0.1:8765",
      fetchImpl: fetchImpl as typeof fetch,
    });

    const ids = await client.addNotes([
      {
        deckName: "Test::Deck",
        modelName: "Basic",
        fields: { Front: "<p>Q1</p>", Back: "<p>A1</p>" },
        tags: ["tag-1"],
      },
      {
        deckName: "Test::Deck",
        modelName: "Basic",
        fields: { Front: "<p>Q2</p>", Back: "<p>A2</p>" },
        tags: ["tag-2"],
      },
    ]);

    expect(ids).toEqual([1001, 1002]);
  });

  test("invokeMulti posts actions and returns ordered results", async () => {
    const fetchImpl = mock(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.action).toBe("multi");
      expect(body.params.actions).toEqual([
        { action: "findNotes", params: { query: 'tag:"obsidian-id::a"' } },
        { action: "findNotes", params: { query: 'tag:"obsidian-id::b"' } },
      ]);
      return new Response(
        JSON.stringify({ result: [[11], []], error: null }),
      );
    });

    const client = new AnkiConnectClient({
      url: "http://127.0.0.1:8765",
      fetchImpl: fetchImpl as typeof fetch,
    });

    const results = await client.invokeMulti<number[][]>([
      { action: "findNotes", params: { query: 'tag:"obsidian-id::a"' } },
      { action: "findNotes", params: { query: 'tag:"obsidian-id::b"' } },
    ]);

    expect(results).toEqual([[11], []]);
  });

  test("invokeMulti returns empty array for no actions", async () => {
    const client = new AnkiConnectClient({ url: "http://127.0.0.1:8765" });
    await expect(client.invokeMulti([])).resolves.toEqual([]);
  });
});
