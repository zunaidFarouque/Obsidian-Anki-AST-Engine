import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runSync } from "../src/syncPipeline";
import type { Config } from "../src/config/configParser";
import { assertFixtureMediaReady, NON_IMAGE_MEDIA_FIXTURE_FILES } from "./helpers/fixtureMedia";

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

  test("complex-media-non-image compiles svg, sound, and pdf embeds without unresolved embeds", async () => {
    const vaultPath = FIXTURES_DIR;
    await assertFixtureMediaReady(vaultPath, NON_IMAGE_MEDIA_FIXTURE_FILES);

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["."],
      defaultAnkiDeck: "Synced from Obsidian",
      ...baseConfig,
    };

    const { actions } = await runSync(config, { dryRun: true });
    const mediaCard = actions.find((action) =>
      action.tag.includes("Non-image embeds"),
    );

    expect(mediaCard).toBeDefined();
    expect(mediaCard?.frontHtml).toContain('<img src="sample.svg"');
    expect(mediaCard?.frontHtml).toContain("<p>[sound:sample.mp3]</p>");
    expect(mediaCard?.frontHtml).toContain("<p>[sound:sample.mp4]</p>");
    expect(mediaCard?.frontHtml).toContain('<p><a href="sample.pdf">Lecture slides</a></p>');
    expect(mediaCard?.frontHtml).not.toContain("![[sample.");
    expect(mediaCard?.unresolvedEmbeds ?? []).toEqual([]);
    expect(mediaCard?.wouldUploadMedia).toContain("sample.svg");
    expect(mediaCard?.wouldUploadMedia).toContain("sample.mp3");
    expect(mediaCard?.wouldUploadMedia).toContain("sample.mp4");
    expect(mediaCard?.wouldUploadMedia).toContain("sample.pdf");
    expect(mediaCard?.transclusionResolved).toBe(true);
  });
});
