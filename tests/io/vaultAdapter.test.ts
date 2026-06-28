import { describe, expect, test } from "bun:test";
import { runSync } from "../../src/syncPipeline";
import type { Config } from "../../src/config/configParser";
import type { AnkiConnectClient } from "../../src/anki/client";
import { InMemoryVaultAdapter } from "../../src/io/inMemoryVaultAdapter";

const baseConfig = {
  ankiConnectUrl: "http://127.0.0.1:8765",
  linkFormat: "shortest" as const,
  defaultCardDeclarationHeadingLevel: 4,
  includeParentHeadersAsTags: true,
  defaultEngineTag: "Obsidian-Anki-AST",
};

function createMockClient(overrides: Partial<AnkiConnectClient> = {}): AnkiConnectClient {
  const findNotesImpl =
    overrides.findNotes ?? (async () => [] as number[]);

  return {
    canConnect: async () => true,
    version: async () => 6,
    invoke: async () => {
      throw new Error("Unexpected invoke");
    },
    invokeMulti:
      overrides.invokeMulti ??
      (async (actions) =>
        Promise.all(
          actions.map(async (action) => {
            if (action.action === "findNotes") {
              return findNotesImpl(action.params?.query as string);
            }
            throw new Error(`unsupported multi action ${action.action}`);
          }),
        )),
    deckNames: async () => ["Test"],
    createDeck: async () => 1,
    modelNames: async () => ["Basic"],
    findNotes: findNotesImpl,
    notesInfo: async () => [],
    addNote: async () => 12345,
    addNotes: async (notes) => notes.map(() => 12345),
    updateNoteFields: async () => undefined,
    updateNoteTags: async () => undefined,
    storeMediaFile: async () => "ok",
    mediaFiles: async () => [],
    ...overrides,
  } as unknown as AnkiConnectClient;
}

describe("VaultAdapter integration", () => {
  test("runSync dry-run reads markdown via injected in-memory vault adapter", async () => {
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

    const vault = new InMemoryVaultAdapter("/vault", {
      "Notes/physics.md": noteContent,
    });

    const config: Config = {
      vaultPath: vault.vaultRoot,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Science::Physics",
      ...baseConfig,
    };

    const { actions } = await runSync(config, {
      dryRun: true,
      vault,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      action: "add",
      deck: "Science::Physics",
      tag: "Science::Newton",
      file: "/vault/Notes/physics.md",
    });
    expect(actions[0]?.frontHtml).toContain("<p>What is g</p>");
    expect(actions[0]?.backHtml).toContain("9.8");
    expect(vault.getText("Notes/physics.md")).toBe(noteContent);
  });

  test("live sync injects anki-id via vault adapter writeText", async () => {
    const noteContent = [
      "---",
      "AnkiSync: on",
      "cardDeclarationHeadingLevel: 4",
      "---",
      "",
      "#### Card",
      "",
      "Front",
      "",
      ":::",
      "",
      "Back",
    ].join("\n");

    const vault = new InMemoryVaultAdapter("/vault", {
      "Notes/card.md": noteContent,
    });

    const config: Config = {
      vaultPath: vault.vaultRoot,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Test",
      ...baseConfig,
    };

    const { actions } = await runSync(config, {
      dryRun: false,
      vault,
      forceBase64Media: true,
      ankiClient: createMockClient(),
    });

    expect(actions[0]?.action).toBe("add");
    const updated = vault.getText("Notes/card.md");
    expect(updated).toContain("<!--anki-id:");
    expect(updated).not.toBe(noteContent);
  });
});
