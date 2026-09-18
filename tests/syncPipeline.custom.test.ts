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
            const query = a.params?.query ?? "";
            const match = query.match(/tag:"obsidian-id::([^"]+)"/);
            if (match) {
              const uuid = match[1];
              const found: number[] = [];
              for (const [id, note] of state.existingNotes.entries()) {
                if (note.tags.includes(`obsidian-id::${uuid}`)) {
                  found.push(id);
                }
              }
              return found;
            }
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
    findNotes: async (query: string) => {
      const match = query.match(/tag:"obsidian-id::([^"]+)"/);
      if (match) {
        const uuid = match[1];
        const found: number[] = [];
        for (const [id, note] of state.existingNotes.entries()) {
          if (note.tags.includes(`obsidian-id::${uuid}`)) {
            found.push(id);
          }
        }
        return found;
      }
      const found: number[] = [];
      for (const [id, note] of state.existingNotes.entries()) {
        for (const field of Object.values(note.fields)) {
          const stripped = field.value.replace(/<[^>]+>/g, "").trim();
          if (stripped && query.includes(stripped)) {
            found.push(id);
          }
        }
      }
      return found;
    },
    notesInfo: async (noteIds: number[]) => {
      return noteIds
        .map((id) => state.existingNotes.get(id))
        .filter((n): n is NoteInfo => n !== undefined);
    },
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
      const existing = state.existingNotes.get(noteId);
      if (existing) {
        for (const [k, v] of Object.entries(fields)) {
          existing.fields[k] = { value: v, order: 0 };
        }
      }
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
  const root = await mkdtemp(join(tmpdir(), "anki-custom-test-"));
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

describe("customCard syncPipeline", () => {
  test("dry-run sync plans add for custom card with custom model and fields", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
---

#### Entropy #anki/noteType/Vocab

::: Word
Entropy

::: Definition
A measure of molecular randomness or disorder.
`;

    await withTempVault("entropy.md", noteContent, async ({ config }) => {
      const result = await runSync(config, {
        dryRun: true,
        noteTypeFieldNamesByNoteType: {
          Vocab: ["Word", "Definition"],
        },
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.action).toBe("add");
      expect(action.resolvedType).toBe("custom");
      expect(action.modelName).toBe("Vocab");
      expect(action.frontHtml).toContain("Entropy");
      expect(action.backHtml).toContain("A measure of molecular randomness or disorder.");
      expect(action.syncError).toBeUndefined();

      const summary = summarizeSyncActions(result.actions);
      expect(summary.added).toBe(1);
      expect(summary.typeMix.custom).toBe(1);
      expect(summary.typeMix.basic).toBe(0);
    });
  });

  test("live sync adds custom card and surgically injects anki-id at tail", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
---

#### Entropy #anki/noteType/Vocab

::: Word
Entropy

::: Definition
A measure of molecular randomness or disorder.
`;

    await withTempVault("entropy.md", noteContent, async ({ config, filePath }) => {
      const state: MockAnkiState = {
        notesAdded: [],
        notesUpdated: [],
        existingNotes: new Map(),
        modelNames: ["Basic", "Vocab"],
        modelFields: {
          Basic: ["Front", "Back"],
          Vocab: ["Word", "Definition"],
        },
      };
      const client = createMockClient(state);

      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
        noteTypeFieldNamesByNoteType: state.modelFields,
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.action).toBe("add");
      expect(action.resolvedType).toBe("custom");
      expect(action.modelName).toBe("Vocab");

      // Verify AnkiConnect payload
      expect(state.notesAdded).toHaveLength(1);
      const added = state.notesAdded[0]!;
      expect(added.modelName).toBe("Vocab");
      expect(added.fields.Word).toContain("Entropy");
      expect(added.fields.Definition).toContain("A measure of molecular randomness or disorder.");

      // Verify surgical injection into file: comment must be placed AFTER Definition
      const updatedContent = await readFile(filePath, "utf8");
      expect(updatedContent).toContain("<!--anki-id:");
      const defPos = updatedContent.indexOf("disorder.");
      const ankiIdPos = updatedContent.indexOf("<!--anki-id:");
      expect(ankiIdPos).toBeGreaterThan(defPos);
    });
  });

  test("live sync updates existing custom card fields", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
---

#### Entropy #anki/noteType/Vocab

::: Word
Entropy

::: Definition
Updated definition of entropy.

<!--anki-id: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-->
`;

    await withTempVault("entropy.md", noteContent, async ({ config }) => {
      const existingNoteId = 555;
      const state: MockAnkiState = {
        notesAdded: [],
        notesUpdated: [],
        existingNotes: new Map([
          [
            existingNoteId,
            {
              noteId: existingNoteId,
              modelName: "Vocab",
              tags: [
                "Obsidian-Anki-AST",
                "obsidian-id::aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
              ],
              fields: {
                Word: { value: "<p>Entropy</p>", order: 0 },
                Definition: { value: "<p>Old definition</p>", order: 1 },
              },
            },
          ],
        ]),
        modelNames: ["Basic", "Vocab"],
        modelFields: {
          Vocab: ["Word", "Definition"],
        },
      };
      const client = createMockClient(state);

      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
        noteTypeFieldNamesByNoteType: state.modelFields,
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.action).toBe("update");
      expect(action.ankiNoteId).toBe(existingNoteId);

      expect(state.notesUpdated).toHaveLength(1);
      const updated = state.notesUpdated[0]!;
      expect(updated.noteId).toBe(existingNoteId);
      expect(updated.fields.Definition).toContain("Updated definition of entropy.");
    });
  });

  test("missing custom model in Anki fails with explicit error (Contract §2.4)", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
---

#### NonExistent #anki/noteType/MissingModel

::: Field1
Value1

::: Field2
Value2
`;

    await withTempVault("missing.md", noteContent, async ({ config }) => {
      const state: MockAnkiState = {
        notesAdded: [],
        notesUpdated: [],
        existingNotes: new Map(),
        modelNames: ["Basic"], // MissingModel is not here!
        modelFields: {
          Basic: ["Front", "Back"],
        },
      };
      const client = createMockClient(state);

      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.action).toBe("skip");
      expect(action.syncError).toContain("Anki note type not found: MissingModel");
      expect(state.notesAdded).toHaveLength(0);
    });
  });

  test("file with one missing custom model and one valid basic card syncs basic card and reports error on custom", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
---

#### Valid Basic
Question
:::
Answer

#### Bad Custom #anki/noteType/UnknownModel

::: FieldA
ContentA

::: FieldB
ContentB
`;

    await withTempVault("mixed.md", noteContent, async ({ config }) => {
      const state: MockAnkiState = {
        notesAdded: [],
        notesUpdated: [],
        existingNotes: new Map(),
        modelNames: ["Basic"],
        modelFields: {
          Basic: ["Front", "Back"],
        },
      };
      const client = createMockClient(state);

      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
      });

      expect(result.actions).toHaveLength(2);
      const basicAction = result.actions.find((a) => a.tag.includes("Valid Basic"))!;
      const customAction = result.actions.find((a) => a.tag.includes("Bad Custom"))!;

      expect(basicAction.action).toBe("add");
      expect(basicAction.syncError).toBeUndefined();

      expect(customAction.action).toBe("skip");
      expect(customAction.syncError).toContain("Anki note type not found: UnknownModel");

      // Verify that Basic card was added to Anki despite the error on custom card
      expect(state.notesAdded).toHaveLength(1);
      expect(state.notesAdded[0]!.modelName).toBe("Basic");
    });
  });

  test("case-insensitive field mapping matches author casing to Anki model casing (CUS-06)", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
---

#### Quantum #anki/noteType/Physics

::: word
Quantum

::: definition
Minimum unit of energy.
`;

    await withTempVault("case.md", noteContent, async ({ config }) => {
      const state: MockAnkiState = {
        notesAdded: [],
        notesUpdated: [],
        existingNotes: new Map(),
        modelNames: ["Basic", "Physics"],
        modelFields: {
          Physics: ["Word", "Definition"], // Model has capitalized Word & Definition
        },
      };
      const client = createMockClient(state);

      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
        noteTypeFieldNamesByNoteType: state.modelFields,
      });

      expect(result.actions).toHaveLength(1);
      expect(state.notesAdded).toHaveLength(1);
      const added = state.notesAdded[0]!;
      expect(added.fields.Word).toBeDefined();
      expect(added.fields.Word).toContain("Quantum");
      expect(added.fields.Definition).toBeDefined();
      expect(added.fields.Definition).toContain("Minimum unit of energy.");
      expect(added.fields.word).toBeUndefined();
      expect(added.fields.definition).toBeUndefined();
    });
  });

  test("frontmatter anki_customCardDefault applies custom model without explicit hashtag", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
anki_customCardDefault: Vocab
---

#### Osmosis

::: Word
Osmosis

::: Definition
Movement of water molecules across a semipermeable membrane.
`;

    await withTempVault("default.md", noteContent, async ({ config }) => {
      const state: MockAnkiState = {
        notesAdded: [],
        notesUpdated: [],
        existingNotes: new Map(),
        modelNames: ["Basic", "Vocab"],
        modelFields: {
          Vocab: ["Word", "Definition"],
        },
      };
      const client = createMockClient(state);

      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
        noteTypeFieldNamesByNoteType: state.modelFields,
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.action).toBe("add");
      expect(action.resolvedType).toBe("custom");
      expect(action.modelName).toBe("Vocab");
      expect(state.notesAdded).toHaveLength(1);
      expect(state.notesAdded[0]!.modelName).toBe("Vocab");
    });
  });

  test("footnotes across custom field blocks are compiled and embedded properly", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
---

#### Mitosis #anki/noteType/Biology

::: Term
Mitosis[^1]

::: Explanation
Cellular division[^2] resulting in two identical daughter cells.

[^1]: From Greek mitos (warp thread).
[^2]: Nuclear division process.
`;

    await withTempVault("footnotes.md", noteContent, async ({ config }) => {
      const state: MockAnkiState = {
        notesAdded: [],
        notesUpdated: [],
        existingNotes: new Map(),
        modelNames: ["Basic", "Biology"],
        modelFields: {
          Biology: ["Term", "Explanation"],
        },
      };
      const client = createMockClient(state);

      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
        noteTypeFieldNamesByNoteType: state.modelFields,
      });

      expect(result.actions).toHaveLength(1);
      expect(state.notesAdded).toHaveLength(1);
      const added = state.notesAdded[0]!;
      expect(added.fields.Term).toContain("From Greek mitos");
      expect(added.fields.Explanation).toContain("Nuclear division process");
    });
  });

  test("existing note is Basic, updated card is custom Vocab -> blocks incompatible migration", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
---

#### Entropy #anki/noteType/Vocab

::: Word
Entropy

::: Definition
A measure of molecular randomness or disorder.

<!--anki-id: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-->
`;

    await withTempVault("entropy.md", noteContent, async ({ config }) => {
      const existingNoteId = 777;
      const state: MockAnkiState = {
        notesAdded: [],
        notesUpdated: [],
        existingNotes: new Map([
          [
            existingNoteId,
            {
              noteId: existingNoteId,
              modelName: "Basic",
              tags: [
                "Obsidian-Anki-AST",
                "obsidian-id::aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
              ],
              fields: {
                Front: { value: "<p>Entropy</p>", order: 0 },
                Back: { value: "<p>Old definition</p>", order: 1 },
              },
            },
          ],
        ]),
        modelNames: ["Basic", "Vocab"],
        modelFields: {
          Basic: ["Front", "Back"],
          Vocab: ["Word", "Definition"],
        },
      };
      const client = createMockClient(state);

      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
        noteTypeFieldNamesByNoteType: state.modelFields,
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.action).toBe("skip");
      expect(action.typeMigration?.status).toBe("blocked_incompatible_fields");
      expect(action.syncError).toContain('does not match vault type "Vocab"');
      expect(state.notesUpdated).toHaveLength(0);

      const summary = summarizeSyncActions(result.actions);
      expect(summary.modelMismatchBlocked).toBe(1);
    });
  });

  test("duplicate recovery links custom card by primary sort field", async () => {
    const noteContent = `---
AnkiSync: on
cardDeclarationHeadingLevel: 4
---

#### Entropy #anki/noteType/Vocab

::: Word
Entropy

::: Definition
A measure of molecular randomness or disorder.
`;

    await withTempVault("entropy.md", noteContent, async ({ config, filePath }) => {
      const existingNoteId = 888;
      const state: MockAnkiState = {
        notesAdded: [],
        notesUpdated: [],
        existingNotes: new Map([
          [
            existingNoteId,
            {
              noteId: existingNoteId,
              modelName: "Vocab",
              tags: ["Obsidian-Anki-AST"],
              fields: {
                Word: { value: "<p>Entropy</p>", order: 0 },
                Definition: { value: "<p>Old definition</p>", order: 1 },
              },
            },
          ],
        ]),
        modelNames: ["Basic", "Vocab"],
        modelFields: {
          Vocab: ["Word", "Definition"],
        },
      };

      const client = createMockClient(state);
      client.addNotes = async () => {
        throw new Error("cannot create note because it is a duplicate");
      };

      const result = await runSync(config, {
        dryRun: false,
        ankiClient: client,
        noteTypeFieldNamesByNoteType: state.modelFields,
      });

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0]!;
      expect(action.action).toBe("update");
      expect(action.ankiNoteId).toBe(existingNoteId);

      expect(state.notesUpdated).toHaveLength(1);
      expect(state.notesUpdated[0]!.noteId).toBe(existingNoteId);

      const updatedContent = await readFile(filePath, "utf8");
      expect(updatedContent).toContain("<!--anki-id:");
    });
  });
});
