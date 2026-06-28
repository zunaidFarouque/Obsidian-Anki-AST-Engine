import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runSync } from "../src/syncPipeline";
import type { Config } from "../src/config/configParser";
import { assertFixtureMediaReady } from "./helpers/fixtureMedia";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

const baseConfig = {
  ankiConnectUrl: "http://127.0.0.1:8765",
  linkFormat: "shortest" as const,
  defaultCardDeclarationHeadingLevel: 4,
  includeParentHeadersAsTags: true,
  defaultEngineTag: "Obsidian-Anki-AST",
};

describe("syncPipeline media", () => {
  test("complex-media-paths compiles wiki and markdown images without unresolved embeds", async () => {
    const vaultPath = FIXTURES_DIR;
    await assertFixtureMediaReady(vaultPath);

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["."],
      defaultAnkiDeck: "Synced from Obsidian",
      ...baseConfig,
    };

    const { actions } = await runSync(config, { dryRun: true });
    const mediaCard = actions.find((action) =>
      action.tag.includes("Organelle Identification"),
    );

    expect(mediaCard).toBeDefined();
    expect(mediaCard?.frontHtml).toContain(
      '<img src="toppng.com-cartoon-1254x1254.png"',
    );
    expect(mediaCard?.frontHtml).toContain('<img src="path.png"');
    expect(mediaCard?.frontHtml).toContain('<img src="jpeg-home.jpg"');
    expect(mediaCard?.frontHtml).toContain('<img src="koala.webp"');
    expect(mediaCard?.frontHtml).not.toContain("![[assets/nested/another folderrrr");
    expect(mediaCard?.unresolvedEmbeds ?? []).toEqual([]);
    expect(mediaCard?.wouldUploadMedia).toContain("toppng.com-cartoon-1254x1254.png");
    expect(mediaCard?.wouldUploadMedia).toContain("path.png");
    expect(mediaCard?.wouldUploadMedia).toContain("jpeg-home.jpg");
    expect(mediaCard?.wouldUploadMedia).toContain("koala.webp");
    expect(mediaCard?.transclusionResolved).toBe(true);
  });
});
