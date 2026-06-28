import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  AnkiConnectClient,
  AnkiConnectError,
  createAnkiClient,
} from "../../src/anki/client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = mock(handler) as typeof fetch;
}

describe("AnkiConnectClient", () => {
  test("invoke posts action and returns result", async () => {
    mockFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.action).toBe("version");
      expect(body.version).toBe(6);
      return new Response(JSON.stringify({ result: 6, error: null }));
    });

    const client = new AnkiConnectClient({ url: "http://127.0.0.1:8765" });
    await expect(client.version()).resolves.toBe(6);
  });

  test("invoke includes apiKey when configured", async () => {
    mockFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.key).toBe("secret-key");
      return new Response(JSON.stringify({ result: 6, error: null }));
    });

    const client = new AnkiConnectClient({
      url: "http://127.0.0.1:8765",
      apiKey: "secret-key",
    });
    await client.version();
  });

  test("invoke throws AnkiConnectError when error field is set", async () => {
    mockFetch(async () => {
      return new Response(
        JSON.stringify({ result: null, error: "collection not available" }),
      );
    });

    const client = new AnkiConnectClient({ url: "http://127.0.0.1:8765" });
    expect(client.version()).rejects.toThrow(AnkiConnectError);
  });

  test("canConnect returns true when version succeeds", async () => {
    mockFetch(async () => {
      return new Response(JSON.stringify({ result: 6, error: null }));
    });

    const client = createAnkiClient({
      ankiConnectUrl: "http://127.0.0.1:8765",
      vaultPath: "/vault",
      delimiter: ":::",
      scanFolders: ["."],
      defaultAnkiDeck: "Default",
    });

    await expect(client.canConnect()).resolves.toBe(true);
  });

  test("addNote sends Basic model fields", async () => {
    mockFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.action).toBe("addNote");
      expect(body.params.note.modelName).toBe("Basic");
      expect(body.params.note.fields.Front).toBe("<p>Q</p>");
      expect(body.params.note.fields.Back).toBe("<p>A</p>");
      return new Response(JSON.stringify({ result: 12345, error: null }));
    });

    const client = new AnkiConnectClient({ url: "http://127.0.0.1:8765" });
    const noteId = await client.addNote({
      deckName: "Test::Deck",
      modelName: "Basic",
      fields: { Front: "<p>Q</p>", Back: "<p>A</p>" },
      tags: ["CS101::Entropy", "obsidian-id::uuid-1"],
    });
    expect(noteId).toBe(12345);
  });

  test("deleteNotes sends note ids", async () => {
    mockFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.action).toBe("deleteNotes");
      expect(body.params.notes).toEqual([10, 20]);
      return new Response(JSON.stringify({ result: null, error: null }));
    });

    const client = new AnkiConnectClient({ url: "http://127.0.0.1:8765" });
    await client.deleteNotes([10, 20]);
  });

  test("findCards and suspendCards invoke expected actions", async () => {
    const calls: string[] = [];
    mockFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      calls.push(body.action);
      if (body.action === "findCards") {
        return new Response(JSON.stringify({ result: [501], error: null }));
      }
      return new Response(JSON.stringify({ result: null, error: null }));
    });

    const client = new AnkiConnectClient({ url: "http://127.0.0.1:8765" });
    await expect(client.findCards("nid:99")).resolves.toEqual([501]);
    await client.suspendCards([501]);
    expect(calls).toEqual(["findCards", "suspendCards"]);
  });
});
