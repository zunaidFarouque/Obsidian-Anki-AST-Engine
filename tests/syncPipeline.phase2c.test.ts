/**
 * Phase 2c — TYP-05 multi-answer + model migration / type-mix summary.
 *
 * Decisions: DECIDED-Preview-Sync-Contract §2.3 / §2.5; 02 D6; 03 D3; 01 D6
 */
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AnkiConnectClient } from "../src/anki/client";
import type { AddNoteParams } from "../src/anki/client";
import {
  runSync,
  summarizeSyncActions,
  summarizeSyncTypeMix,
} from "../src/syncPipeline";
import type { Config } from "../src/config/configParser";

const STOCK_BASIC = "Basic";
const STOCK_CLOZE = "Cloze";
const STOCK_REVERSIBLE = "Basic (and reversed card)";
const STOCK_TYPED = "Basic (type in the answer)";

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

function createCapturingClient(captures: {
  notes: CapturedNote[];
}): AnkiConnectClient {
  const findNotesImpl = async () => [] as number[];

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
    modelNames: async () => [
      STOCK_BASIC,
      STOCK_CLOZE,
      STOCK_REVERSIBLE,
      STOCK_TYPED,
    ],
    findNotes: findNotesImpl,
    notesInfo: async () => [],
    addNote: async (note) => {
      captures.notes.push(note);
      return 22_000 + captures.notes.length;
    },
    addNotes: async (notes) => {
      const ids: number[] = [];
      for (const note of notes) {
        captures.notes.push(note);
        ids.push(22_000 + captures.notes.length);
      }
      return ids;
    },
    updateNoteFields: async () => undefined,
    updateNoteTags: async () => undefined,
    storeMediaFile: async () => "",
    mediaFiles: async () => [],
    deleteNotes: async () => undefined,
    findCards: async () => [],
    cardsInfo: async () => [],
    suspend: async () => undefined,
  } as unknown as AnkiConnectClient;
}

async function withTempVault(
  fileName: string,
  content: string,
  run: (ctx: { config: Config; vaultPath: string }) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "phase2c-"));
  const vaultPath = join(root, "vault");
  try {
    await mkdir(join(vaultPath, "Notes"), { recursive: true });
    await writeFile(join(vaultPath, "Notes", fileName), content, "utf8");
    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Science",
      ...baseConfig,
    };
    await run({ config, vaultPath });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function frontmatterOn(): string {
  return [
    "---",
    "AnkiSync: on",
    "cardDeclarationHeadingLevel: 4",
    "---",
    "",
  ].join("\n");
}

describe("Phase 2c — TYP-05 multi-answer typed sync", () => {
  test("pipe-separated typed answers sync as Paris|Lyon|Marseille (space-tolerant)", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "multi-answer.md",
      [
        frontmatterOn(),
        "# Science",
        "",
        "#### City",
        "",
        "Capital of France?",
        "",
        ":::t",
        "",
        "Paris | Lyon | Marseille",
      ].join("\n"),
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
        expect(note.modelName).toBe(STOCK_TYPED);
        expect(note.fields.Back).toBe("Paris|Lyon|Marseille");
      },
    );
  });

  test("unspaced Paris|Lyon and spaced Answer one | Answer two both normalize", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "two-typed.md",
      [
        frontmatterOn(),
        "# Science",
        "",
        "#### A",
        "",
        "Q1?",
        "",
        ":::t",
        "",
        "Paris|Lyon",
        "",
        "#### B",
        "",
        "Q2?",
        "",
        ":::t",
        "",
        "Answer one | Answer two",
      ].join("\n"),
      async ({ config }) => {
        const { actions } = await runSync(config, {
          dryRun: false,
          ankiClient: client,
        });

        expect(actions).toHaveLength(2);
        expect(captures.notes.map((n) => n.fields.Back)).toEqual([
          "Paris|Lyon",
          "Answer one|Answer two",
        ]);
      },
    );
  });
});

describe("Phase 2c — pre-sync type mix summary", () => {
  test("summarizeSyncTypeMix counts resolved built-in types from actions", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "mix.md",
      [
        frontmatterOn(),
        "# Science",
        "",
        "#### Basic card",
        "",
        "Front?",
        "",
        ":::",
        "",
        "Back.",
        "",
        "#### Typed card",
        "",
        "Capital?",
        "",
        ":::t",
        "",
        "Paris",
        "",
        "#### Rev card",
        "",
        "Q",
        "",
        ":::r",
        "",
        "A",
      ].join("\n"),
      async ({ config }) => {
        const { actions } = await runSync(config, {
          dryRun: true,
          ankiClient: client,
        });

        const mix = summarizeSyncTypeMix(actions);
        expect(mix.basic).toBe(1);
        expect(mix.typed).toBe(1);
        expect(mix.reversible).toBe(1);
        expect(mix.cloze).toBe(0);
        expect(mix.custom).toBe(0);
        expect(mix.total).toBe(3);

        const summary = summarizeSyncActions(actions);
        expect(summary.typeMix).toEqual(mix);
        expect(summary.typeMigrated).toBe(0);
        expect(summary.modelMismatchBlocked).toBe(0);
        expect(summary).toMatchObject({
          added: expect.any(Number),
          updated: expect.any(Number),
          skipped: expect.any(Number),
          failed: expect.any(Number),
          typeMigrated: expect.any(Number),
          modelMismatchBlocked: expect.any(Number),
          typeMix: mix,
        });
      },
    );
  });
});
