import { describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSync } from "../src/syncPipeline";
import type { Config } from "../src/config/configParser";
import { MEDIA_HASH_SEPARATOR } from "../src/anki/mediaNaming";

const baseConfig = {
  ankiConnectUrl: "http://127.0.0.1:8765",
  linkFormat: "shortest" as const,
  defaultCardDeclarationHeadingLevel: 4,
  includeParentHeadersAsTags: true,
  defaultEngineTag: "Obsidian-Anki-AST",
};

describe("syncPipeline media collision", () => {
  test("disambiguates same basename in different folders with distinct anki uploads", async () => {
    const vaultPath = await mkdtemp(join(tmpdir(), "media-collision-"));
    await mkdir(join(vaultPath, "notes", "a"), { recursive: true });
    await mkdir(join(vaultPath, "notes", "b"), { recursive: true });

    const koalaFixture = join(import.meta.dir, "fixtures/assets/media/koala.webp");
    const jpegFixture = join(import.meta.dir, "fixtures/assets/media/jpeg-home.jpg");
    await copyFile(koalaFixture, join(vaultPath, "notes", "a", "koala.webp"));
    await copyFile(jpegFixture, join(vaultPath, "notes", "b", "koala.webp"));

    const cardTemplate = (title: string) =>
      [
        "---",
        "AnkiSync: on",
        "cardDeclarationHeadingLevel: 4",
        "---",
        "",
        `# ${title}`,
        "",
        "#### Image card",
        "",
        "What animal?",
        "",
        "![[koala.webp]]",
        "",
        ":::",
        "",
        "Answer.",
      ].join("\n");

    await writeFile(
      join(vaultPath, "notes", "a", "card-a.md"),
      cardTemplate("Folder A"),
    );
    await writeFile(
      join(vaultPath, "notes", "b", "card-b.md"),
      cardTemplate("Folder B"),
    );

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["notes"],
      defaultAnkiDeck: "Media Collision",
      ...baseConfig,
    };

    const { actions, mediaWarnings } = await runSync(config, { dryRun: true });

    const cardA = actions.find((action) => action.tag.includes("Folder A"));
    const cardB = actions.find((action) => action.tag.includes("Folder B"));

    expect(cardA).toBeDefined();
    expect(cardB).toBeDefined();
    expect(mediaWarnings).toHaveLength(1);
    expect(mediaWarnings[0]?.kind).toBe("media_basename_disambiguated");

    const srcA = cardA?.frontHtml?.match(/src="([^"]+)"/)?.[1];
    const srcB = cardB?.frontHtml?.match(/src="([^"]+)"/)?.[1];
    expect(srcA).toContain(MEDIA_HASH_SEPARATOR);
    expect(srcB).toContain(MEDIA_HASH_SEPARATOR);
    expect(srcA).not.toBe(srcB);

    const uploads = new Set([
      ...(cardA?.wouldUploadMedia ?? []),
      ...(cardB?.wouldUploadMedia ?? []),
    ]);
    expect(uploads.has(srcA!)).toBe(true);
    expect(uploads.has(srcB!)).toBe(true);

    await rm(vaultPath, { recursive: true, force: true });
  });
});
