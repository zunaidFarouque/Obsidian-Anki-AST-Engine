import { describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Config } from "../src/config/configParser";
import { runSync } from "../src/syncPipeline";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

describe("syncPipeline injection offsets", () => {
  test("live sync injects transclusion-on-back id after embed, not in HTML checklist", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-inject-offset-"));
    const vaultPath = join(root, "vault");
    await mkdir(vaultPath, { recursive: true });

    await copyFile(
      join(FIXTURES_DIR, "card-feature-stress-test.md"),
      join(vaultPath, "card-feature-stress-test.md"),
    );
    await copyFile(join(FIXTURES_DIR, "embed_me.md"), join(vaultPath, "embed_me.md"));

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["."],
      defaultAnkiDeck: "Injection::Test",
      defaultEngineTag: "Obsidian-Anki-AST",
      ankiConnectUrl: "http://127.0.0.1:8765",
      noteModelName: "Basic",
      autoCreateDecks: true,
      syncTagPrefix: "obsidian-id",
      linkFormat: "shortest",
      defaultCardDeclarationHeadingLevel: 4,
      includeParentHeadersAsTags: true,
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      switch (body.action) {
        case "version":
          return new Response(JSON.stringify({ result: 6, error: null }));
        case "deckNames":
          return new Response(JSON.stringify({ result: [], error: null }));
        case "createDeck":
          return new Response(JSON.stringify({ result: 1, error: null }));
        case "getMediaFilesNames":
          return new Response(JSON.stringify({ result: [], error: null }));
        case "findNotes":
          return new Response(JSON.stringify({ result: [], error: null }));
        case "addNote":
          return new Response(JSON.stringify({ result: 1001, error: null }));
        default:
          return new Response(JSON.stringify({ result: null, error: null }));
      }
    };

    try {
      await runSync(config, { dryRun: false });

      const written = await readFile(
        join(vaultPath, "card-feature-stress-test.md"),
        "utf8",
      );

      const checklistEnd = written.indexOf("-->");
      const transclusionBackMarker = "What note is transcluded on the back of this card?";
      const transclusionSectionStart = written.indexOf(transclusionBackMarker);
      expect(transclusionSectionStart).toBeGreaterThan(-1);

      const idsInChecklist = [
        ...written
          .slice(0, checklistEnd)
          .matchAll(/<!--anki-id: [0-9a-f-]+-->/gi),
      ];
      expect(idsInChecklist).toHaveLength(0);

      const afterTransclusion = written.slice(transclusionSectionStart);
      expect(afterTransclusion).toMatch(
        /!\[\[embed_me#This section is for embedding\]\][\s\S]*<!--anki-id: [0-9a-f-]+-->/,
      );
    } finally {
      globalThis.fetch = originalFetch;
      await rm(root, { recursive: true, force: true });
    }
  });
});
