import { describe, expect, test } from "bun:test";
import type { AnkiConnectClient, CreateModelParams } from "../../src/anki/client";
import { createModelEnsurer } from "../../src/anki/modelEnsurer";
import {
  STOCK_ANKI_MODEL_NAMES,
  stockModelCreateParams,
} from "../../src/anki/stockNoteModels";

function createMockClient(
  overrides: Partial<AnkiConnectClient> = {},
): AnkiConnectClient {
  return {
    modelNames: async () => [STOCK_ANKI_MODEL_NAMES.basic],
    createModel: async () => null,
    ...overrides,
  } as unknown as AnkiConnectClient;
}

describe("modelEnsurer", () => {
  test("modelNames is called once across multiple ensureModel calls for existing model", async () => {
    let modelNamesCalls = 0;
    const client = createMockClient({
      modelNames: async () => {
        modelNamesCalls += 1;
        return [STOCK_ANKI_MODEL_NAMES.basic, STOCK_ANKI_MODEL_NAMES.cloze];
      },
    });

    const ensurer = createModelEnsurer(client, true);
    await Promise.all([
      ensurer.ensureModel(STOCK_ANKI_MODEL_NAMES.cloze),
      ensurer.ensureModel(STOCK_ANKI_MODEL_NAMES.cloze),
      ensurer.ensureModel(STOCK_ANKI_MODEL_NAMES.basic),
    ]);

    expect(modelNamesCalls).toBe(1);
  });

  test("parallel ensureModel for missing stock model calls createModel once", async () => {
    const created: CreateModelParams[] = [];
    const client = createMockClient({
      modelNames: async () => [STOCK_ANKI_MODEL_NAMES.basic],
      createModel: async (params) => {
        created.push(params);
        return null;
      },
    });

    const ensurer = createModelEnsurer(client, true);
    await Promise.all([
      ensurer.ensureModel(STOCK_ANKI_MODEL_NAMES.cloze),
      ensurer.ensureModel(STOCK_ANKI_MODEL_NAMES.cloze),
    ]);

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject(stockModelCreateParams("cloze"));
    expect(created[0]?.isCloze).toBe(true);
  });

  test("creates all four stock built-ins with stock templates when missing", async () => {
    const created: CreateModelParams[] = [];
    const client = createMockClient({
      modelNames: async () => [],
      createModel: async (params) => {
        created.push(params);
        return null;
      },
    });

    const ensurer = createModelEnsurer(client, true);
    await ensurer.ensureModel(STOCK_ANKI_MODEL_NAMES.basic);
    await ensurer.ensureModel(STOCK_ANKI_MODEL_NAMES.cloze);
    await ensurer.ensureModel(STOCK_ANKI_MODEL_NAMES.reversible);
    await ensurer.ensureModel(STOCK_ANKI_MODEL_NAMES.typed);

    expect(created.map((c) => c.modelName)).toEqual([
      STOCK_ANKI_MODEL_NAMES.basic,
      STOCK_ANKI_MODEL_NAMES.cloze,
      STOCK_ANKI_MODEL_NAMES.reversible,
      STOCK_ANKI_MODEL_NAMES.typed,
    ]);
    expect(created.find((c) => c.modelName === STOCK_ANKI_MODEL_NAMES.typed)?.cardTemplates[0]?.Front).toContain(
      "{{type:Back}}",
    );
    expect(
      created.find((c) => c.modelName === STOCK_ANKI_MODEL_NAMES.reversible)
        ?.cardTemplates,
    ).toHaveLength(2);
  });

  test("throws when model missing and autoCreateStockNoteModels is false", async () => {
    const client = createMockClient({
      modelNames: async () => [STOCK_ANKI_MODEL_NAMES.basic],
    });

    const ensurer = createModelEnsurer(client, false);
    await expect(ensurer.ensureModel(STOCK_ANKI_MODEL_NAMES.cloze)).rejects.toThrow(
      /Anki note type not found: Cloze/i,
    );
  });

  test("throws for unknown (non-stock) model names even when auto-create is on", async () => {
    const client = createMockClient({
      modelNames: async () => [],
    });

    const ensurer = createModelEnsurer(client, true);
    await expect(ensurer.ensureModel("Custom Vocab")).rejects.toThrow(
      /Anki note type not found: Custom Vocab/i,
    );
  });
});
