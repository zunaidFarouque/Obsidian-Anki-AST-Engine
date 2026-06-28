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
        deckMappings: [
          { obsidianFolder: "Notes", ankiDeck: "Default::Notes" },
        ],
        ankiConnectUrl: "http://127.0.0.1:8765",
      }),
    );

    const config = await loadConfig(configPath);
    expect(config.vaultPath).toBe("/vault");
    expect(config.delimiter).toBe("?");
    expect(config.deckMappings).toHaveLength(1);
    expect(config.ankiConnectUrl).toBe("http://127.0.0.1:8765");
    expect(config.defaultCardDeclarationHeadingLevel).toBe(4);
    expect(config.includeParentHeadersAsTags).toBe(true);

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
        deckMappings: [{ obsidianFolder: "Cards", ankiDeck: "Cards" }],
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
        deckMappings: [{ obsidianFolder: "Notes", ankiDeck: "Notes" }],
      }),
    );

    expect(loadConfig(configPath)).rejects.toThrow(/vaultPath/i);

    await rm(dir, { recursive: true, force: true });
  });

  test("rejects empty deckMappings", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: "/vault",
        delimiter: "?",
        deckMappings: [],
      }),
    );

    expect(loadConfig(configPath)).rejects.toThrow(/deckMappings/i);

    await rm(dir, { recursive: true, force: true });
  });

  test("applies default delimiter when omitted", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        vaultPath: "/vault",
        deckMappings: [{ obsidianFolder: "Notes", ankiDeck: "Notes" }],
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
        deckMappings: [{ obsidianFolder: "Notes", ankiDeck: "Notes" }],
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
        deckMappings: [{ obsidianFolder: "Notes", ankiDeck: "Notes" }],
        ankiConnectUrl: "not-a-url",
      }),
    );

    expect(loadConfig(configPath)).rejects.toThrow(/ankiConnectUrl/i);

    await rm(dir, { recursive: true, force: true });
  });
});
