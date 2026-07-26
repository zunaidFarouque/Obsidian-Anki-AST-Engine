/**
 * Phase 2b TDD — inferCloze on sync + auto-create stock note models.
 *
 * Decisions: 01 D4, 02 D5, 05 D4
 * Contract: Docs/DECIDING/DECIDED-Preview-Sync-Contract-2026-07.md §1 / §2.4
 */
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AnkiConnectClient } from "../src/anki/client";
import type { AddNoteParams } from "../src/anki/client";
import type { CreateModelParams } from "../src/anki/client";
import { runSync } from "../src/syncPipeline";
import type { Config } from "../src/config/configParser";
import { STOCK_ANKI_MODEL_NAMES } from "../src/anki/stockNoteModels";

const STOCK_BASIC = STOCK_ANKI_MODEL_NAMES.basic;
const STOCK_CLOZE = STOCK_ANKI_MODEL_NAMES.cloze;
const STOCK_REVERSIBLE = STOCK_ANKI_MODEL_NAMES.reversible;
const STOCK_TYPED = STOCK_ANKI_MODEL_NAMES.typed;

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

type CapturedNote = AddNoteParams;

function createCapturingClient(options: {
  notes: CapturedNote[];
  createdModels?: CreateModelParams[];
  existingModels?: string[];
}): AnkiConnectClient {
  const findNotesImpl = async () => [] as number[];
  const models = new Set(
    options.existingModels ?? [
      STOCK_BASIC,
      STOCK_CLOZE,
      STOCK_REVERSIBLE,
      STOCK_TYPED,
    ],
  );

  return {
    canConnect: async () => true,
    version: async () => 6,
    invoke: async () => {
      throw new Error("Unexpected invoke");
    },
    invokeMulti: async (actions) =>
      Promise.all(
        actions.map(async (action) => {
          if (action.action === "findNotes") {
            return findNotesImpl();
          }
          throw new Error(`unsupported multi action ${action.action}`);
        }),
      ),
    deckNames: async () => ["Science"],
    createDeck: async () => 1,
    modelNames: async () => [...models],
    createModel: async (params) => {
      options.createdModels?.push(params);
      models.add(params.modelName);
      return null;
    },
    findNotes: findNotesImpl,
    notesInfo: async () => [],
    addNote: async (note) => {
      options.notes.push(note);
      return 13_000 + options.notes.length;
    },
    addNotes: async (notes) => {
      options.notes.push(...notes);
      return notes.map(
        (_, index) =>
          13_000 + options.notes.length - notes.length + index + 1,
      );
    },
    updateNoteFields: async () => undefined,
    updateNoteTags: async () => undefined,
    storeMediaFile: async () => "ok",
    mediaFiles: async () => [],
  } as unknown as AnkiConnectClient;
}

async function withTempVault(
  noteRelativePath: string,
  noteContent: string,
  configOverrides: Partial<Config>,
  run: (args: { vaultPath: string; config: Config }) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "anki-phase2b-"));
  const vaultPath = join(root, "vault");
  const notesDir = join(vaultPath, "Notes");
  await mkdir(notesDir, { recursive: true });
  await writeFile(join(notesDir, noteRelativePath), noteContent, "utf8");

  const config: Config = {
    vaultPath,
    delimiter: ":::",
    scanFolders: ["Notes"],
    defaultAnkiDeck: "Science",
    ...baseConfig,
    ...configOverrides,
  };

  try {
    await run({ vaultPath, config });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function frontmatterBasicDefault(): string {
  return [
    "---",
    "AnkiSync: on",
    "cardDeclarationHeadingLevel: 4",
    "anki_cardDefault: basic",
    "---",
    "",
  ].join("\n");
}

describe("Phase 2b — inferClozeFromManualSyntaxOnBasic on sync", () => {
  test("setting true → basic+{{cN}} syncs as Cloze (matches preview reclassify)", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "infer-cloze.md",
      [
        frontmatterBasicDefault(),
        "# Science",
        "",
        "#### Auto cloze?",
        "",
        "The {{c1::mitochondria}} is important.",
        "",
        ":::",
        "",
        "Powerhouse.",
      ].join("\n"),
      { inferClozeFromManualSyntaxOnBasic: true },
      async ({ config }) => {
        const { actions } = await runSync(config, {
          dryRun: false,
          ankiClient: client,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.action).toBe("add");
        expect(actions[0]?.syncError).toBeUndefined();

        expect(captures.notes).toHaveLength(1);
        const note = captures.notes[0]!;
        // Preview reclassifies to cloze; sync must use Cloze model (01 D4 parity)
        expect(note.modelName).toBe(STOCK_CLOZE);
        expect(note.fields.Text).toContain("{{c1::mitochondria}}");
        expect(note.fields.Front).toBeUndefined();
      },
    );
  });

  test("setting false (default) → basic+{{cN}} stays Basic with literal", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "literal-cloze.md",
      [
        frontmatterBasicDefault(),
        "# Science",
        "",
        "#### Literal?",
        "",
        "The {{c1::mitochondria}} is important.",
        "",
        ":::",
        "",
        "Powerhouse.",
      ].join("\n"),
      { inferClozeFromManualSyntaxOnBasic: false },
      async ({ config }) => {
        const { actions } = await runSync(config, {
          dryRun: false,
          ankiClient: client,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.action).toBe("add");

        expect(captures.notes).toHaveLength(1);
        const note = captures.notes[0]!;
        expect(note.modelName).toBe(STOCK_BASIC);
        expect(note.fields.Front).toContain("{{c1::mitochondria}}");
        expect(note.fields.Text).toBeUndefined();
      },
    );
  });
});

describe("Phase 2b — auto-create stock note models", () => {
  test("missing Cloze model is created when autoCreateStockNoteModels is true", async () => {
    const captures = {
      notes: [] as CapturedNote[],
      createdModels: [] as CreateModelParams[],
    };
    const client = createCapturingClient({
      ...captures,
      existingModels: [STOCK_BASIC],
    });

    await withTempVault(
      "need-cloze.md",
      [
        "---",
        "AnkiSync: on",
        "cardDeclarationHeadingLevel: 4",
        "---",
        "",
        "# Science",
        "",
        "#### Cell #anki/cardType/cloze",
        "",
        "The {{c1::mitochondria}} produces ATP.",
        "",
        ":::",
        "",
        "Extra.",
      ].join("\n"),
      { autoCreateStockNoteModels: true },
      async ({ config }) => {
        const { actions } = await runSync(config, {
          dryRun: false,
          ankiClient: client,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.action).toBe("add");
        expect(actions[0]?.syncError).toBeUndefined();

        expect(captures.createdModels.some((m) => m.modelName === STOCK_CLOZE)).toBe(
          true,
        );
        expect(captures.notes).toHaveLength(1);
        expect(captures.notes[0]?.modelName).toBe(STOCK_CLOZE);
      },
    );
  });

  test("opt-out: missing model fails clearly when autoCreateStockNoteModels is false", async () => {
    const captures = {
      notes: [] as CapturedNote[],
      createdModels: [] as CreateModelParams[],
    };
    const client = createCapturingClient({
      ...captures,
      existingModels: [STOCK_BASIC],
    });

    await withTempVault(
      "no-auto-model.md",
      [
        "---",
        "AnkiSync: on",
        "cardDeclarationHeadingLevel: 4",
        "---",
        "",
        "# Science",
        "",
        "#### Cell #anki/cardType/cloze",
        "",
        "The {{c1::mitochondria}} produces ATP.",
        "",
        ":::",
        "",
        "Extra.",
      ].join("\n"),
      { autoCreateStockNoteModels: false },
      async ({ config }) => {
        const { actions } = await runSync(config, {
          dryRun: false,
          ankiClient: client,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.action).toBe("skip");
        expect(actions[0]?.syncError).toMatch(/Cloze/i);
        expect(actions[0]?.syncError).toMatch(/not found|create/i);
        expect(captures.createdModels).toHaveLength(0);
        expect(captures.notes).toHaveLength(0);
      },
    );
  });
});
