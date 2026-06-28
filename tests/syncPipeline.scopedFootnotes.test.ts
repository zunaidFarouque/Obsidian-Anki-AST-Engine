import { describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../src/config/configParser";
import { runSync } from "../src/syncPipeline";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

describe("syncPipeline scoped footnotes", () => {
  test("dry-run resolves section-scoped footnotes for multiple cards", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-scoped-fn-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    await copyFile(
      join(FIXTURES_DIR, "card-footnotes-scoped.md"),
      join(notesDir, "card-footnotes-scoped.md"),
    );

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      defaultCardDeclarationHeadingLevel: 4,
      includeParentHeadersAsTags: true,
      scanFolders: ["Notes"],
      defaultAnkiDeck: "DryRun::Fixtures",
      defaultEngineTag: "Obsidian-Anki-AST",
    };

    const { actions } = await runSync(config, { dryRun: true });
    const cardA = actions.find((a) => a.tag.endsWith("Card A"));
    const cardB = actions.find((a) => a.tag.endsWith("Card B"));
    const cardC = actions.find((a) => a.tag.endsWith("Card C"));

    expect(cardA).toBeDefined();
    expect(cardB).toBeDefined();
    expect(cardC).toBeDefined();
    expect(cardA?.frontHtml).toContain("Applies to all Week 2 cards");
    expect(cardA?.frontHtml).toContain("<hr>");
    expect(cardB?.frontHtml).toContain("Card-local override example");
    expect(cardC?.frontHtml).toContain("Should not apply to Week 2 cards");
    expect(cardA?.frontHtml).not.toContain("Should not apply to Week 2 cards");

    await rm(root, { recursive: true, force: true });
  });
});
