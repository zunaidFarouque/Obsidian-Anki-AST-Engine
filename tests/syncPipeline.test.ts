import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSync } from "../src/syncPipeline";
import type { Config } from "../src/config/configParser";

const baseConfig = {
  ankiConnectUrl: "http://127.0.0.1:8765",
  linkFormat: "shortest" as const,
  defaultCardDeclarationHeadingLevel: 4,
  includeParentHeadersAsTags: true,
  defaultEngineTag: "Obsidian-Anki-AST",
};

describe("syncPipeline", () => {
  test("dry-run extracts cards and reports add actions without writing files", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-sync-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const notePath = join(notesDir, "physics.md");
    const noteContent = [
      "---",
      "AnkiSync: on",
      "cardDeclarationHeadingLevel: 4",
      "---",
      "",
      "# Science",
      "",
      "#### Newton",
      "",
      "What is g",
      "",
      ":::",
      "",
      "9.8 m/s^2",
    ].join("\n");
    await writeFile(notePath, noteContent, "utf8");

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Science::Physics",
      ...baseConfig,
    };

    const { actions } = await runSync(config, { dryRun: true });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      action: "add",
      deck: "Science::Physics",
      tag: "Science::Newton",
      file: notePath,
    });
    expect(actions[0]?.frontHtml).toContain("<p>What is g</p>");
    expect(actions[0]?.backHtml).toContain("9.8");
    expect(actions[0]?.wouldInjectId).toBeDefined();

    const contentAfter = await Bun.file(notePath).text();
    expect(contentAfter).toBe(noteContent);

    await rm(root, { recursive: true, force: true });
  });

  test("reports update action when card already has anki-id", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-sync-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const notePath = join(notesDir, "existing.md");
    const noteContent = [
      "---",
      "AnkiSync: on",
      "cardDeclarationHeadingLevel: 4",
      "---",
      "",
      "# Science",
      "",
      "#### Laws",
      "",
      "F = ma",
      "",
      ":::",
      "",
      "Newton's second law",
      `<!--anki-id: ${uuid}-->`,
    ].join("\n");
    await writeFile(notePath, noteContent, "utf8");

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Science",
      ...baseConfig,
    };

    const { actions } = await runSync(config, { dryRun: true });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.action).toBe("update");
    expect(actions[0]?.ankiId).toBe(uuid);
    expect(actions[0]?.wouldInjectId).toBeUndefined();

    await rm(root, { recursive: true, force: true });
  });

  test("skips files when AnkiSync is off", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-off-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const notePath = join(notesDir, "disabled.md");
    const noteContent = [
      "---",
      "AnkiSync: off",
      "cardDeclarationHeadingLevel: 4",
      "---",
      "",
      "# Science",
      "",
      "#### Gravity",
      "",
      "What is g",
      "",
      ":::",
      "",
      "9.8 m/s^2",
    ].join("\n");
    await writeFile(notePath, noteContent, "utf8");

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Science",
      ...baseConfig,
    };

    const { actions } = await runSync(config, { dryRun: true });
    expect(actions).toHaveLength(0);

    await rm(root, { recursive: true, force: true });
  });

  test("uses frontmatter delimiter override when config default is :::", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-override-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const notePath = join(notesDir, "legacy.md");
    const noteContent = [
      "---",
      "AnkiSync: on",
      "cardDeclarationHeadingLevel: 4",
      'delimiter: "?"',
      "---",
      "",
      "# Science",
      "",
      "#### Gravity",
      "",
      "What is g",
      "",
      "?",
      "",
      "9.8 m/s^2",
    ].join("\n");
    await writeFile(notePath, noteContent, "utf8");

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Science",
      ...baseConfig,
    };

    const { actions } = await runSync(config, { dryRun: true });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.tag).toBe("Science::Gravity");
    expect(actions[0]?.frontHtml).toContain("<p>What is g</p>");
    expect(actions[0]?.backHtml).toContain("9.8");

    await rm(root, { recursive: true, force: true });
  });

  test("reports wouldUploadMedia for complex-media-paths fixture", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-media-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    const assetsDir = join(notesDir, "assets", "nested");
    await mkdir(assetsDir, { recursive: true });

    const fixturePath = join(import.meta.dir, "fixtures/complex-media-paths.md");
    const notePath = join(notesDir, "complex-media-paths.md");
    await copyFile(fixturePath, notePath);
    await writeFile(join(notesDir, "Cell Diagram final.png"), "png");
    await writeFile(join(assetsDir, "path.png"), "png");

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Science",
      ...baseConfig,
    };

    const { actions } = await runSync(config, { dryRun: true });
    expect(actions).toHaveLength(1);
    expect(actions[0]?.wouldUploadMedia?.length).toBeGreaterThanOrEqual(1);
    expect(actions[0]?.tag).toBe("Cell Biology::Organelle Identification");
    expect(actions[0]?.backHtml).toContain("Mitochondria");

    await rm(root, { recursive: true, force: true });
  });

  test("reports unresolved embeds when target is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-unresolved-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const fixturePath = join(
      import.meta.dir,
      "fixtures/obsidian-parity/unresolved-embed.md",
    );
    const notePath = join(notesDir, "unresolved-embed.md");
    await copyFile(fixturePath, notePath);

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Science",
      ...baseConfig,
    };

    const { actions } = await runSync(config, { dryRun: true });
    expect(actions).toHaveLength(1);
    expect(actions[0]?.unresolvedEmbeds?.length).toBeGreaterThan(0);
    expect(actions[0]?.transclusionResolved).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  test("uses target_anki_deck frontmatter override for deck", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-deck-override-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const notePath = join(notesDir, "custom-deck.md");
    const noteContent = [
      "---",
      "AnkiSync: on",
      'target_anki_deck: "My Custom Deck"',
      "cardDeclarationHeadingLevel: 4",
      "---",
      "",
      "# Science",
      "",
      "#### Gravity",
      "",
      "What is g",
      "",
      ":::",
      "",
      "9.8 m/s^2",
    ].join("\n");
    await writeFile(notePath, noteContent, "utf8");

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Synced from Obsidian",
      ...baseConfig,
    };

    const { actions } = await runSync(config, { dryRun: true });
    expect(actions).toHaveLength(1);
    expect(actions[0]?.deck).toBe("My Custom Deck");

    await rm(root, { recursive: true, force: true });
  });

  test("dry-run reports duplicate warnings when vault cards share the same front", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-sync-dup-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    const sharedFront = [
      "---",
      "AnkiSync: on",
      "cardDeclarationHeadingLevel: 4",
      "---",
      "",
      "# Course",
      "",
      "#### Shared Question",
      "",
      "What is entropy?",
      "",
      ":::",
      "",
    ].join("\n");

    await writeFile(
      join(notesDir, "note-a.md"),
      `${sharedFront}Answer from note A.\n`,
      "utf8",
    );
    await writeFile(
      join(notesDir, "note-b.md"),
      `${sharedFront}Answer from note B.\n`,
      "utf8",
    );

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Science::Physics",
      ...baseConfig,
    };

    const { actions, duplicateWarnings } = await runSync(config, { dryRun: true });
    expect(actions).toHaveLength(2);
    expect(duplicateWarnings).toHaveLength(1);
    expect(duplicateWarnings[0]?.kind).toBe("back_mismatch");
    expect(duplicateWarnings[0]?.sources).toHaveLength(2);

    await rm(root, { recursive: true, force: true });
  });
});
