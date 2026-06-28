import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../../src/config/configParser";

describe("configParser", () => {
  test("parses a valid config file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: "/vault",
        delimiter: "?",
        scanFolders: ["Notes"],
        defaultAnkiDeck: "Default::Notes",
        defaultEngineTag: "Obsidian-Anki-AST",
        ankiConnectUrl: "http://127.0.0.1:8765",
      }),
    );

    const config = await loadConfig(configPath);
    expect(config.vaultPath).toBe("/vault");
    expect(config.delimiter).toBe("?");
    expect(config.scanFolders).toEqual(["Notes"]);
    expect(config.defaultAnkiDeck).toBe("Default::Notes");
    expect(config.defaultEngineTag).toBe("Obsidian-Anki-AST");
    expect(config.ankiConnectUrl).toBe("http://127.0.0.1:8765");
    expect(config.defaultCardDeclarationHeadingLevel).toBe(4);
    expect(config.includeParentHeadersAsTags).toBe(true);
    expect(config.noteModelName).toBe("Basic");
    expect(config.autoCreateDecks).toBe(true);
    expect(config.syncTagPrefix).toBe("obsidian-id");

    await rm(dir, { recursive: true, force: true });
  });

  test("parses optional anki integration fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: "/vault",
        scanFolders: ["Notes"],
        ankiConnectApiKey: "secret",
        noteModelName: "Basic",
        autoCreateDecks: false,
        syncTagPrefix: "oid",
      }),
    );

    const config = await loadConfig(configPath);
    expect(config.ankiConnectApiKey).toBe("secret");
    expect(config.autoCreateDecks).toBe(false);
    expect(config.syncTagPrefix).toBe("oid");
    expect(config.defaultAnkiDeck).toBe("Synced from Obsidian");
    expect(config.defaultEngineTag).toBe("Obsidian-Anki-AST");

    await rm(dir, { recursive: true, force: true });
  });

  test("applies default ankiConnectUrl when omitted", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: "/vault",
        delimiter: "---",
        scanFolders: ["Cards"],
      }),
    );

    const config = await loadConfig(configPath);
    expect(config.ankiConnectUrl).toBe("http://127.0.0.1:8765");

    await rm(dir, { recursive: true, force: true });
  });

  test("rejects missing vaultPath", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        delimiter: "?",
        scanFolders: ["Notes"],
      }),
    );

    expect(loadConfig(configPath)).rejects.toThrow(/vaultPath/i);

    await rm(dir, { recursive: true, force: true });
  });

  test("rejects empty scanFolders", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: "/vault",
        delimiter: "?",
        scanFolders: [],
      }),
    );

    expect(loadConfig(configPath)).rejects.toThrow(/scanFolders/i);

    await rm(dir, { recursive: true, force: true });
  });

  test("applies default delimiter when omitted", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: "/vault",
        scanFolders: ["Notes"],
      }),
    );

    const config = await loadConfig(configPath);
    expect(config.delimiter).toBe(":::");

    await rm(dir, { recursive: true, force: true });
  });

  test("applies default includeParentHeadersAsTags when omitted", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: "/vault",
        scanFolders: ["Notes"],
      }),
    );

    const config = await loadConfig(configPath);
    expect(config.includeParentHeadersAsTags).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });

  test("rejects invalid ankiConnectUrl", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: "/vault",
        delimiter: "?",
        scanFolders: ["Notes"],
        ankiConnectUrl: "not-a-url",
      }),
    );

    expect(loadConfig(configPath)).rejects.toThrow(/ankiConnectUrl/i);

    await rm(dir, { recursive: true, force: true });
  });
});
