/**
 * Phase 2 TDD — RED tests for multi-type Anki sync (built-in models).
 *
 * These tests DEFINE Phase 2 success. They are expected to FAIL until a Phase 2
 * agent implements stock-model mapping in sync (Cloze / reversible / typed).
 * Do NOT “fix” failures by weakening assertions — make syncEngine/syncPipeline green.
 *
 * Decisions: CurrentWorkMD/_DecisionsNeeded_02_CardTypesAnkiSync.md (D1–D3, D7)
 *            CurrentWorkMD/_DecisionsNeeded_05_PriorityAndPhasing.md (Phase 2)
 * Status:    CurrentWorkMD/_ImplementationStatus_Phase2_RED.md
 *
 * Stock Anki model names (spec defaults; remapping later):
 *   basic      → "Basic"                         Front / Back
 *   cloze      → "Cloze"                         Text / Back Extra
 *   reversible → "Basic (and reversed card)"     Front / Back
 *   typed      → "Basic (type in the answer)"     Front / Back (plain text)
 */
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AnkiConnectClient } from "../src/anki/client";
import type { AddNoteParams } from "../src/anki/client";
import { runSync } from "../src/syncPipeline";
import type { Config } from "../src/config/configParser";

/** Spec / decision stock model names — Phase 2 must use these (remapping later). */
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
      return 12_000 + captures.notes.length;
    },
    addNotes: async (notes) => {
      captures.notes.push(...notes);
      return notes.map((_, index) => 12_000 + captures.notes.length - notes.length + index + 1);
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
  run: (args: { vaultPath: string; config: Config }) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "anki-phase2-"));
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
  };

  try {
    await run({ vaultPath, config });
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

describe("Phase 2 — multi-type Anki sync (stock models)", () => {
  // RED until Phase 2 implementation
  test("cloze-resolved card → addNotes uses Cloze model with Text / Back Extra (not Basic)", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "cloze.md",
      [
        frontmatterOn(),
        "# Science",
        "",
        "#### Cell #anki/cardType/cloze",
        "",
        "The {{c1::mitochondria}} produces ATP.",
        "",
        ":::",
        "",
        "Extra diagram link here.",
      ].join("\n"),
      async ({ config }) => {
        const { actions } = await runSync(config, {
          dryRun: false,
          ankiClient: client,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.action).toBe("add");
        expect(actions[0]?.syncError).toBeUndefined();
        expect(actions[0]?.wouldInjectId).toBeDefined();

        expect(captures.notes).toHaveLength(1);
        const note = captures.notes[0]!;
        // Snapshot Text before toMatchObject — Bun's expect.stringContaining mutates the matched property.
        const clozeText = note.fields.Text;

        // RED until Phase 2 implementation — must not dump cloze onto Basic
        expect(note.modelName).toBe(STOCK_CLOZE);
        expect(note.modelName).not.toBe(STOCK_BASIC);
        expect(note.fields).toMatchObject({
          Text: expect.stringContaining("{{c1::mitochondria}}"),
        });
        expect(clozeText).toContain("produces ATP");
        expect(note.fields["Back Extra"]).toContain("Extra diagram link here");
        expect(note.fields.Front).toBeUndefined();
        expect(note.fields.Back).toBeUndefined();
      },
    );
  });

  test("front-only cloze (no :::) syncs Cloze and plans wouldInjectId at front end", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "cloze-front-only.md",
      [
        frontmatterOn(),
        "# Science",
        "",
        "#### Cell #anki/cardType/cloze",
        "",
        "The {{c1::mitochondria}} produces ATP.",
      ].join("\n"),
      async ({ vaultPath, config }) => {
        const { actions } = await runSync(config, {
          dryRun: false,
          ankiClient: client,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.action).toBe("add");
        expect(actions[0]?.syncError).toBeUndefined();
        expect(actions[0]?.wouldInjectId).toBeDefined();
        expect(actions[0]?.resolvedType).toBe("cloze");

        expect(captures.notes).toHaveLength(1);
        const note = captures.notes[0]!;
        expect(note.modelName).toBe(STOCK_CLOZE);
        expect(note.fields.Text).toContain("{{c1::mitochondria}}");
        expect(note.fields.Text).toContain("produces ATP");
        expect(note.fields["Back Extra"] ?? "").toBe("");
        expect(note.fields.Front).toBeUndefined();
        expect(note.fields.Back).toBeUndefined();

        const written = await Bun.file(
          join(vaultPath, "Notes", "cloze-front-only.md"),
        ).text();
        const uuid = actions[0]!.wouldInjectId!;
        expect(written).toContain(`<!--anki-id: ${uuid}-->`);
        const frontMarker = "The {{c1::mitochondria}} produces ATP.";
        const frontEnd = written.indexOf(frontMarker) + frontMarker.length;
        expect(written.indexOf(`<!--anki-id: ${uuid}-->`)).toBeGreaterThan(
          frontEnd - 1,
        );
        expect(written).not.toContain(":::");
      },
    );
  });

  // RED until Phase 2 implementation
  test("reversible card (:::r) → Basic (and reversed card) with Front / Back", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "reversible-delim.md",
      [
        frontmatterOn(),
        "# Science",
        "",
        "#### Vocab",
        "",
        "What is ATP?",
        "",
        ":::r",
        "",
        "Adenosine triphosphate",
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

        // RED until Phase 2 implementation
        expect(note.modelName).toBe(STOCK_REVERSIBLE);
        expect(note.fields.Front).toContain("What is ATP?");
        expect(note.fields.Back).toContain("Adenosine triphosphate");
        // No stray delimiter letter (already Phase 1); still required for Phase 2 path
        expect(note.fields.Back).not.toMatch(/^\s*r\b/);
      },
    );
  });

  // RED until Phase 2 implementation
  test("reversible card (#anki/cardType/reversible) → Basic (and reversed card)", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "reversible-tag.md",
      [
        frontmatterOn(),
        "# Science",
        "",
        "#### Vocab #anki/cardType/reversible",
        "",
        "What is ATP?",
        "",
        ":::",
        "",
        "Adenosine triphosphate",
      ].join("\n"),
      async ({ config }) => {
        const { actions } = await runSync(config, {
          dryRun: false,
          ankiClient: client,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.action).toBe("add");
        expect(captures.notes).toHaveLength(1);

        // RED until Phase 2 implementation
        expect(captures.notes[0]?.modelName).toBe(STOCK_REVERSIBLE);
        expect(captures.notes[0]?.fields.Front).toContain("What is ATP?");
        expect(captures.notes[0]?.fields.Back).toContain("Adenosine triphosphate");
      },
    );
  });

  // RED until Phase 2 implementation
  test("typed card (:::t) → Basic (type in the answer) with plain-text Back", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "typed.md",
      [
        frontmatterOn(),
        "# Science",
        "",
        "#### Capital",
        "",
        "Capital of France?",
        "",
        ":::t",
        "",
        "**Paris** with <sub>accent</sub>",
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

        // RED until Phase 2 implementation — stock typed model + TYP-03/04 / 02 D7
        expect(note.modelName).toBe(STOCK_TYPED);
        expect(note.fields.Front).toContain("Capital of France?");
        expect(note.fields.Back).toBe("Paris with accent");
        // Must not leave HTML/markdown in the type-in answer field
        expect(note.fields.Back).not.toContain("<");
        expect(note.fields.Back).not.toContain("**");
        expect(note.fields.Back).not.toMatch(/<p>/);
      },
    );
  });

  // Regression guard — may already pass after Phase 1
  test("cardSyntax skip still blocks Anki write (Phase 1 regression guard)", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "skip.md",
      [
        frontmatterOn(),
        "# Science",
        "",
        "#### Incomplete",
        "",
        "Only front text, no delimiter.",
      ].join("\n"),
      async ({ config }) => {
        const { actions } = await runSync(config, {
          dryRun: false,
          ankiClient: client,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]?.action).toBe("skip");
        expect(actions[0]?.skipReason).toBe("preview_skip");
        expect(actions[0]?.previewOutcome).toBe("skip");
        expect(actions[0]?.wouldInjectId).toBeUndefined();
        expect(captures.notes).toHaveLength(0);
      },
    );
  });

  // Regression guard — basic must remain Basic (additive Phase 2)
  test("valid basic still syncs as Basic with Front / Back", async () => {
    const captures = { notes: [] as CapturedNote[] };
    const client = createCapturingClient(captures);

    await withTempVault(
      "basic.md",
      [
        frontmatterOn(),
        "# Science",
        "",
        "#### Newton",
        "",
        "What is g",
        "",
        ":::",
        "",
        "9.8 m/s^2",
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

        expect(note.modelName).toBe(STOCK_BASIC);
        expect(note.fields.Front).toContain("What is g");
        expect(note.fields.Back).toContain("9.8");
        expect(note.fields.Text).toBeUndefined();
        expect(note.fields["Back Extra"]).toBeUndefined();
      },
    );
  });
});
