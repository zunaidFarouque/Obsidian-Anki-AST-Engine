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
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Live::Test",
      defaultEngineTag: "Obsidian-Anki-AST",
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
        case "multi":
          return new Response(
            JSON.stringify({
              result: body.params.actions.map(() => []),
              error: null,
            }),
          );
        case "addNotes":
          addedNotes.push(...body.params.notes);
          return new Response(
            JSON.stringify({
              result: body.params.notes.map(
                (_note: unknown, index: number) => 1001 + index,
              ),
              error: null,
            }),
          );
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
      const { actions } = await runSync(config, { dryRun: false });
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

  test("live sync recovers duplicate and injects anki-id into vault file", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-live-dup-"));
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

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      defaultCardDeclarationHeadingLevel: 4,
      includeParentHeadersAsTags: true,
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Live::Dup",
      defaultEngineTag: "Obsidian-Anki-AST",
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
        return new Response(JSON.stringify({ result: ["Live::Dup"], error: null }));
      }
      if (body.action === "getMediaFilesNames") {
        return new Response(JSON.stringify({ result: [], error: null }));
      }
      if (body.action === "findNotes") {
        const query = String(body.params.query);
        if (query.includes('tag:"obsidian-id::')) {
          return new Response(JSON.stringify({ result: [], error: null }));
        }
        if (query.includes('front:"Question"')) {
          return new Response(JSON.stringify({ result: [88], error: null }));
        }
        return new Response(JSON.stringify({ result: [], error: null }));
      }
      if (body.action === "multi") {
        return new Response(
          JSON.stringify({
            result: body.params.actions.map(() => []),
            error: null,
          }),
        );
      }
      if (body.action === "addNotes") {
        return new Response(
          JSON.stringify({ result: [null], error: null }),
        );
      }
      if (body.action === "notesInfo") {
        return new Response(
          JSON.stringify({
            result: [
              {
                noteId: 88,
                tags: ["legacy"],
                fields: {
                  Front: { value: "<p>Question</p>", order: 0 },
                  Back: { value: "<p>Answer</p>", order: 1 },
                },
              },
            ],
            error: null,
          }),
        );
      }
      if (body.action === "addNote") {
        return new Response(
          JSON.stringify({
            result: null,
            error: "cannot create note because it is a duplicate",
          }),
        );
      }
      if (body.action === "updateNoteTags") {
        return new Response(JSON.stringify({ result: null, error: null }));
      }
      return new Response(JSON.stringify({ result: null, error: null }));
    }) as typeof fetch;

    try {
      const { actions } = await runSync(config, { dryRun: false });
      expect(actions[0]?.syncError).toBeUndefined();
      expect(actions[0]?.action).toBe("update");

      const after = await readFile(sourcePath, "utf8");
      expect(after).toContain("<!--anki-id:");
    } finally {
      globalThis.fetch = originalFetch;
      await rm(root, { recursive: true, force: true });
    }
  });

  test("live sync does not write file when addNote fails without recoverable duplicate", async () => {
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
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Live::Fail",
      defaultEngineTag: "Obsidian-Anki-AST",
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
      if (body.action === "multi") {
        return new Response(
          JSON.stringify({
            result: body.params.actions.map(() => []),
            error: null,
          }),
        );
      }
      if (body.action === "addNotes") {
        return new Response(
          JSON.stringify({ result: null, error: "collection unavailable" }),
        );
      }
      if (body.action === "addNote") {
        return new Response(
          JSON.stringify({ result: null, error: "collection unavailable" }),
        );
      }
      return new Response(JSON.stringify({ result: null, error: null }));
    }) as typeof fetch;

    try {
      const { actions } = await runSync(config, { dryRun: false });
      expect(actions[0]?.syncError).toContain("collection unavailable");
      const after = await readFile(sourcePath, "utf8");
      expect(after).toBe(original);
    } finally {
      globalThis.fetch = originalFetch;
      await rm(root, { recursive: true, force: true });
    }
  });

  test("live sync injects first card when second card fails in same file", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-live-partial-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const sourcePath = join(notesDir, "two-cards.md");
    await writeFile(
      sourcePath,
      [
        "---",
        "AnkiSync: on",
        "cardDeclarationHeadingLevel: 4",
        "---",
        "",
        "#### Card One",
        "",
        "Question one",
        "",
        ":::",
        "",
        "Answer one",
        "",
        "#### Card Two",
        "",
        "Question two",
        "",
        ":::",
        "",
        "Answer two",
        "",
      ].join("\n"),
    );

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      defaultCardDeclarationHeadingLevel: 4,
      includeParentHeadersAsTags: true,
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Live::Partial",
      defaultEngineTag: "Obsidian-Anki-AST",
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
        return new Response(JSON.stringify({ result: [], error: null }));
      }
      if (body.action === "createDeck") {
        return new Response(JSON.stringify({ result: 1, error: null }));
      }
      if (body.action === "getMediaFilesNames") {
        return new Response(JSON.stringify({ result: [], error: null }));
      }
      if (body.action === "findNotes") {
        return new Response(JSON.stringify({ result: [], error: null }));
      }
      if (body.action === "multi") {
        return new Response(
          JSON.stringify({
            result: body.params.actions.map(() => []),
            error: null,
          }),
        );
      }
      if (body.action === "addNotes") {
        return new Response(
          JSON.stringify({ result: null, error: "batch rejected" }),
        );
      }
      if (body.action === "addNote") {
        const front = body.params.note.fields.Front as string;
        if (front.includes("Question two")) {
          return new Response(
            JSON.stringify({ result: null, error: "boom" }),
          );
        }
        return new Response(JSON.stringify({ result: 1001, error: null }));
      }
      return new Response(JSON.stringify({ result: null, error: null }));
    }) as typeof fetch;

    try {
      const { actions } = await runSync(config, { dryRun: false });
      expect(actions[0]?.syncError).toBeUndefined();
      expect(actions[1]?.syncError).toContain("boom");

      const after = await readFile(sourcePath, "utf8");
      expect(after.match(/<!--anki-id: [0-9a-f-]+-->/gi)?.length).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
      await rm(root, { recursive: true, force: true });
    }
  });

  test("live sync relinks VISA cards without anki-id via heading tag and front match", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-live-visa-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const fixturePath = join(
      import.meta.dir,
      "fixtures",
      "_converted VISA answers unified.md",
    );
    const fixture = await readFile(fixturePath, "utf8");
    const withoutIds = fixture.replace(
      /<!--\s*anki-id:\s*[0-9a-f-]{36}\s*-->\s*/gi,
      "",
    );
    const sourcePath = join(notesDir, "visa.md");
    await writeFile(sourcePath, withoutIds);

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      defaultCardDeclarationHeadingLevel: 4,
      includeParentHeadersAsTags: true,
      scanFolders: ["Notes"],
      defaultAnkiDeck: "VISA",
      defaultEngineTag: "Obsidian-Anki-AST",
      ankiConnectUrl: "http://127.0.0.1:8765",
      noteModelName: "Basic",
      noteModelType: "basic",
      autoCreateDecks: true,
      syncTagPrefix: "obsidian-id",
      linkFormat: "shortest",
    };

    const storedNotes: Record<number, {
      noteId: number;
      tags: string[];
      fields: Record<string, { value: string; order: number }>;
    }> = {
      42: {
        noteId: 42,
        tags: [
          "Obsidian-Anki-AST",
          "VISAF1",
          "General_Questions::Why_Expedite?",
          "obsidian-id::8acaff39-f843-4b76-99de-088a24039dac",
        ],
        fields: {
          Front: {
            value:
              '<p>VO: <em>"Why are you here today instead of your original July appointment? Why couldn\'t you wait?"</em></p>',
            order: 0,
          },
          Back: { value: "<p>Answer</p>", order: 1 },
        },
      },
      88: {
        noteId: 88,
        tags: [
          "Obsidian-Anki-AST",
          "VISAF1",
          "General_Questions::Follow-up_questions::Do_you_have_any_fear_of_returning_to_Bangladesh?",
          "obsidian-id::1a490adf-c248-4009-a32f-92501eeb5b35",
        ],
        fields: {
          Front: {
            value: "<p>Do you have any fear of returning to Bangladesh?</p>",
            order: 0,
          },
          Back: {
            value:
              "<p>No, not at all. Bangladesh is my home, and my family, professional network, and long-term career goals are all there.</p>",
            order: 1,
          },
        },
      },
    };

    globalThis.fetch = mock(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.action === "version") {
        return new Response(JSON.stringify({ result: 6, error: null }));
      }
      if (body.action === "deckNames") {
        return new Response(JSON.stringify({ result: ["VISA"], error: null }));
      }
      if (body.action === "getMediaFilesNames") {
        return new Response(JSON.stringify({ result: [], error: null }));
      }
      if (body.action === "findNotes") {
        const query = String(body.params.query);
        if (query.includes("Why_Expedite")) {
          return new Response(JSON.stringify({ result: [42], error: null }));
        }
        if (query.includes("fear") || query.includes("Bangladesh")) {
          return new Response(JSON.stringify({ result: [88], error: null }));
        }
        if (query.startsWith('deck:"VISA" front:"')) {
          return new Response(JSON.stringify({ result: [], error: null }));
        }
        return new Response(JSON.stringify({ result: [], error: null }));
      }
      if (body.action === "multi") {
        return new Response(
          JSON.stringify({
            result: body.params.actions.map(() => []),
            error: null,
          }),
        );
      }
      if (body.action === "addNotes") {
        return new Response(
          JSON.stringify({
            result: body.params.notes.map(() => null),
            error: null,
          }),
        );
      }
      if (body.action === "addNote") {
        return new Response(
          JSON.stringify({
            result: null,
            error: "cannot create note because it is a duplicate",
          }),
        );
      }
      if (body.action === "notesInfo") {
        const ids = body.params.notes as number[];
        return new Response(
          JSON.stringify({
            result: ids.map((id) => storedNotes[id]).filter(Boolean),
            error: null,
          }),
        );
      }
      if (body.action === "updateNoteTags") {
        return new Response(JSON.stringify({ result: null, error: null }));
      }
      return new Response(JSON.stringify({ result: null, error: null }));
    }) as typeof fetch;

    try {
      const { actions } = await runSync(config, { dryRun: false });
      const expedite = actions.find((action) =>
        action.tag.includes("Why Expedite"),
      );
      const bangladesh = actions.find((action) =>
        action.tag.includes("Fear of Returning"),
      );

      expect(expedite?.syncError).toBeUndefined();
      expect(bangladesh?.syncError).toBeUndefined();
      expect(expedite?.ankiNoteId).toBe(42);
      expect(bangladesh?.ankiNoteId).toBe(88);

      const after = await readFile(sourcePath, "utf8");
      expect(after).toContain("8acaff39-f843-4b76-99de-088a24039dac");
      expect(after).toContain("1a490adf-c248-4009-a32f-92501eeb5b35");
    } finally {
      globalThis.fetch = originalFetch;
      await rm(root, { recursive: true, force: true });
    }
  });
});
