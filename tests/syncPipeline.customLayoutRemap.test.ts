import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AnkiConnectClient, AddNoteParams, NoteInfo } from "../src/anki/client";
import { runSync, summarizeSyncActions } from "../src/syncPipeline";
import type { Config } from "../src/config/configParser";

const baseConfig = {
  ankiConnectUrl: "http://127.0.0.1:8765",
  linkFormat: "shortest" as const,
  defaultCardDeclarationHeadingLevel: 4,
  includeParentHeadersAsTags: true,
  defaultEngineTag: "Obsidian-Anki-AST",
  noteModelName: "Basic",
  noteModelType: "basic" as const,
  autoCreateDecks: true,
  autoCreateStockNoteModels: true,
  inferClozeFromManualSyntaxOnBasic: false,
  syncTagPrefix: "obsidian-id",
};

type MockAnkiState = {
  notesAdded: AddNoteParams[];
  notesUpdated: Array<{ noteId: number; fields: Record<string, string> }>;
  existingNotes: Map<number, NoteInfo>;
  modelNames: string[];
  modelFields: Record<string, string[]>;
};

function createMockClient(state: MockAnkiState): AnkiConnectClient {
  return {
    canConnect: async () => true,
    version: async () => 6,
    invoke: async (action: string, params?: any) => {
      if (action === "modelNames") {
        return state.modelNames;
      }
      if (action === "modelFieldNames") {
        return state.modelFields[params?.modelName] ?? [];
      }
      throw new Error(`Unhandled invoke: ${action}`);
    },
    invokeMulti: async (actions: Array<{ action: string; params?: any }>) => {
      return Promise.all(
        actions.map(async (a) => {
          if (a.action === "findNotes") {
            return [];
          }
          throw new Error(`Unhandled invokeMulti action: ${a.action}`);
        }),
      );
    },
    deckNames: async () => ["Science"],
    createDeck: async () => 1,
    modelNames: async () => state.modelNames,
    modelFieldNames: async (modelName: string) => state.modelFields[modelName] ?? [],
    createModel: async () => null,
    findNotes: async () => [],
    notesInfo: async () => [],
    addNote: async (note: AddNoteParams) => {
      state.notesAdded.push(note);
      const id = 1000 + state.notesAdded.length;
      state.existingNotes.set(id, {
        noteId: id,
        modelName: note.modelName,
        tags: note.tags ?? [],
        fields: Object.fromEntries(
          Object.entries(note.fields).map(([k, v]) => [k, { value: v, order: 0 }]),
        ),
      });
      return id;
    },
    addNotes: async (notes: AddNoteParams[]) => {
      return notes.map((note) => {
        state.notesAdded.push(note);
        const id = 1000 + state.notesAdded.length;
        state.existingNotes.set(id, {
          noteId: id,
          modelName: note.modelName,
          tags: note.tags ?? [],
          fields: Object.fromEntries(
            Object.entries(note.fields).map(([k, v]) => [k, { value: v, order: 0 }]),
          ),
        });
        return id;
      });
    },
    updateNoteFields: async (noteId: number, fields: Record<string, string>) => {
      state.notesUpdated.push({ noteId, fields });
    },
    updateNoteTags: async () => undefined,
    storeMediaFile: async () => "ok",
    mediaFiles: async () => [],
  } as unknown as AnkiConnectClient;
}

async function withTempVault(
  noteRelativePath: string,
  noteContent: string,
  run: (args: { vaultPath: string; config: Config; filePath: string }) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "anki-custom-remap-test-"));
  const vaultPath = join(root, "vault");
  const notesDir = join(vaultPath, "Notes");
  await mkdir(notesDir, { recursive: true });
  const fullFilePath = join(notesDir, noteRelativePath);
  await writeFile(fullFilePath, noteContent, "utf8");

  const config: Config = {
    vaultPath,
    delimiter: ":::",
    scanFolders: ["Notes"],
    defaultAnkiDeck: "Science",
    ...baseConfig,
  };

  try {
    await run({ vaultPath, config, filePath: fullFilePath });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("CUS-07 Custom Field Layout Remapping in syncPipeline", () => {
  test("live sync adds custom card with plain ::: via options.customLayoutMap", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
---

#### Apple #anki/noteType/Vocab

Apple
:::
A sweet, edible fruit produced by an apple tree.
`;

    const state: MockAnkiState = {
      notesAdded: [],
      notesUpdated: [],
      existingNotes: new Map(),
      modelNames: ["Vocab"],
      modelFields: {
        Vocab: ["Word", "Definition"],
      },
    };
    const client = createMockClient(state);

    await withTempVault("apple.md", noteContent, async ({ config, filePath }) => {
      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
        customLayoutMap: {
          Vocab: ["Word", "Definition"],
        },
        noteTypeFieldNamesByNoteType: {
          Vocab: ["Word", "Definition"],
        },
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.action).toBe("add");
      expect(action.resolvedType).toBe("custom");
      expect(action.modelName).toBe("Vocab");
      expect(action.frontHtml).toContain("Apple");
      expect(action.backHtml).toContain("A sweet, edible fruit");

      expect(state.notesAdded).toHaveLength(1);
      const added = state.notesAdded[0]!;
      expect(added.modelName).toBe("Vocab");
      expect(added.fields.Word).toContain("Apple");
      expect(added.fields.Definition).toContain("A sweet, edible fruit");

      // Verify surgical ID injection happened
      const updatedContent = await readFile(filePath, "utf8");
      expect(updatedContent).toContain("anki-id:");
    });
  });

  test("live sync adds custom card with plain ::: via frontmatter anki_customLayoutMap", async () => {
    const noteContent = `---
AnkiSync: on
anki_customCardDefault: Vocab
anki_customLayoutMap: '{"Vocab": ["Word", "Definition"]}'
cardDeclarationHeadingLevel: 4
---

#### Banana

Banana
:::
An elongated, edible fruit.
`;

    const state: MockAnkiState = {
      notesAdded: [],
      notesUpdated: [],
      existingNotes: new Map(),
      modelNames: ["Vocab"],
      modelFields: {
        Vocab: ["Word", "Definition"],
      },
    };
    const client = createMockClient(state);

    await withTempVault("banana.md", noteContent, async ({ config }) => {
      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
        noteTypeFieldNamesByNoteType: {
          Vocab: ["Word", "Definition"],
        },
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.action).toBe("add");
      expect(action.resolvedType).toBe("custom");
      expect(action.modelName).toBe("Vocab");

      expect(state.notesAdded).toHaveLength(1);
      const added = state.notesAdded[0]!;
      expect(added.modelName).toBe("Vocab");
      expect(added.fields.Word).toContain("Banana");
      expect(added.fields.Definition).toContain("An elongated, edible fruit");
    });
  });
});
