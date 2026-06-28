import { describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSync } from "../../src/syncPipeline";
import type { Config } from "../../src/config/configParser";

describe("ignoreLogic", () => {
  test("skips files without sync-eligible frontmatter", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-ignore-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const fixturePath = join(
      import.meta.dir,
      "../fixtures/ignore-invalid-no-sync-trigger.md",
    );
    const notePath = join(notesDir, "ignore-invalid-no-sync-trigger.md");
    await copyFile(fixturePath, notePath);

    const originalContent = await Bun.file(notePath).text();

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      deckMappings: [{ obsidianFolder: "Notes", ankiDeck: "Blog" }],
      ankiConnectUrl: "http://127.0.0.1:8765",
      linkFormat: "shortest",
      defaultCardDeclarationHeadingLevel: 4,
      includeParentHeadersAsTags: true,
    };

    const actions = await runSync(config, { dryRun: true });

    expect(actions).toHaveLength(0);

    const contentAfter = await Bun.file(notePath).text();
    expect(contentAfter).toBe(originalContent);

    await rm(root, { recursive: true, force: true });
  });
});
