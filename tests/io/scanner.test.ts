import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanVault } from "../../src/io/scanner";

describe("scanner", () => {
  test("returns markdown files under mapped folders", async () => {
    const vaultPath = await mkdtemp(join(tmpdir(), "anki-vault-"));
    const scanFolders = ["Notes", "CS"];

    await mkdir(join(vaultPath, "Notes"), { recursive: true });
    await mkdir(join(vaultPath, "CS", "Algorithms"), { recursive: true });
    await mkdir(join(vaultPath, ".obsidian"), { recursive: true });
    await mkdir(join(vaultPath, ".trash"), { recursive: true });

    const notesFile = join(vaultPath, "Notes", "card.md");
    const csFile = join(vaultPath, "CS", "Algorithms", "sort.md");
    const hiddenFile = join(vaultPath, "Notes", ".hidden.md");
    const trashFile = join(vaultPath, ".trash", "deleted.md");
    const obsidianFile = join(vaultPath, ".obsidian", "config.md");

    await writeFile(notesFile, "# Note");
    await writeFile(csFile, "# Sort");
    await writeFile(hiddenFile, "# Hidden");
    await writeFile(trashFile, "# Trash");
    await writeFile(obsidianFile, "# Config");

    const results = await scanVault(vaultPath, scanFolders);
    const normalized = results.map((p) => p.replace(/\\/g, "/"));

    expect(normalized).toContain(notesFile.replace(/\\/g, "/"));
    expect(normalized).toContain(csFile.replace(/\\/g, "/"));
    expect(normalized).not.toContain(hiddenFile.replace(/\\/g, "/"));
    expect(normalized).not.toContain(trashFile.replace(/\\/g, "/"));
    expect(normalized).not.toContain(obsidianFile.replace(/\\/g, "/"));

    await rm(vaultPath, { recursive: true, force: true });
  });

  test("returns empty array when no markdown files exist", async () => {
    const vaultPath = await mkdtemp(join(tmpdir(), "anki-vault-"));
    await mkdir(join(vaultPath, "Empty"), { recursive: true });

    const results = await scanVault(vaultPath, ["Empty"]);
    expect(results).toEqual([]);

    await rm(vaultPath, { recursive: true, force: true });
  });
});
