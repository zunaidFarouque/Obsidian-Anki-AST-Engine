import { describe, expect, mock, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../src/config/configParser";
import { runSync } from "../src/syncPipeline";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

const originalFetch = globalThis.fetch;

describe("syncPipeline live mode", () => {
  test("live sync adds note and injects anki-id into vault file", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-live-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    await copyFile(
      join(FIXTURES_DIR, "injection-required-no-ids.md"),
      join(notesDir, "injection-required-no-ids.md"),
    );

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      defaultCardDeclarationHeadingLevel: 4,
      includeParentHeadersAsTags: true,
      deckMappings: [{ obsidianFolder: "Notes", ankiDeck: "Live::Test" }],
      ankiConnectUrl: "http://127.0.0.1:8765",
      noteModelName: "Basic",
      noteModelType: "basic",
      autoCreateDecks: true,
      syncTagPrefix: "obsidian-id",
      linkFormat: "shortest",
    };

    const addedNotes: Array<Record<string, unknown>> = [];
    const deckCreates: string[] = [];

    globalThis.fetch = mock(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      switch (body.action) {
        case "version":
          return new Response(JSON.stringify({ result: 6, error: null }));
        case "deckNames":
          return new Response(JSON.stringify({ result: [], error: null }));
        case "createDeck":
          deckCreates.push(body.params.deck);
          return new Response(JSON.stringify({ result: 1, error: null }));
        case "getMediaFilesNames":
          return new Response(JSON.stringify({ result: [], error: null }));
        case "findNotes":
          return new Response(JSON.stringify({ result: [], error: null }));
        case "addNote":
          addedNotes.push(body.params.note);
          return new Response(JSON.stringify({ result: 1000 + addedNotes.length, error: null }));
        default:
          return new Response(
            JSON.stringify({ result: null, error: `unexpected action ${body.action}` }),
            { status: 500 },
          );
      }
    }) as typeof fetch;

    try {
      const actions = await runSync(config, { dryRun: false });
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.every((action) => !action.syncError)).toBe(true);
      expect(addedNotes.length).toBe(3);
      expect(deckCreates).toContain("Live::Test");

      const written = await readFile(
        join(notesDir, "injection-required-no-ids.md"),
        "utf8",
      );
      expect(written.match(/<!--anki-id: [0-9a-f-]+-->/gi)?.length).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
      await rm(root, { recursive: true, force: true });
    }
  });

  test("live sync does not write file when Anki addNote fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-live-fail-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const sourcePath = join(notesDir, "single-card.md");
    await writeFile(
      sourcePath,
      [
        "---",
        "AnkiSync: on",
        "cardDeclarationHeadingLevel: 4",
        "---",
        "",
        "#### Test Card",
        "",
        "Question",
        "",
        ":::",
        "",
        "Answer",
        "",
      ].join("\n"),
    );

    const original = await readFile(sourcePath, "utf8");

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      defaultCardDeclarationHeadingLevel: 4,
      includeParentHeadersAsTags: true,
      deckMappings: [{ obsidianFolder: "Notes", ankiDeck: "Live::Fail" }],
      ankiConnectUrl: "http://127.0.0.1:8765",
      noteModelName: "Basic",
      noteModelType: "basic",
      autoCreateDecks: true,
      syncTagPrefix: "obsidian-id",
      linkFormat: "shortest",
    };

    globalThis.fetch = mock(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.action === "version") {
        return new Response(JSON.stringify({ result: 6, error: null }));
      }
      if (body.action === "deckNames") {
        return new Response(JSON.stringify({ result: ["Live::Fail"], error: null }));
      }
      if (body.action === "getMediaFilesNames") {
        return new Response(JSON.stringify({ result: [], error: null }));
      }
      if (body.action === "findNotes") {
        return new Response(JSON.stringify({ result: [], error: null }));
      }
      if (body.action === "addNote") {
        return new Response(
          JSON.stringify({ result: null, error: "duplicate" }),
        );
      }
      return new Response(JSON.stringify({ result: null, error: null }));
    }) as typeof fetch;

    try {
      const actions = await runSync(config, { dryRun: false });
      expect(actions[0]?.syncError).toContain("duplicate");
      const after = await readFile(sourcePath, "utf8");
      expect(after).toBe(original);
    } finally {
      globalThis.fetch = originalFetch;
      await rm(root, { recursive: true, force: true });
    }
  });
});
