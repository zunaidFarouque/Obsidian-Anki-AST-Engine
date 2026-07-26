import type { AnkiConnectClient } from "./client";
import {
  builtinTypeForStockModelName,
  stockModelCreateParams,
} from "./stockNoteModels";

export type ModelEnsurer = {
  ensureModel(modelName: string): Promise<void>;
};

export function createModelEnsurer(
  client: AnkiConnectClient,
  autoCreateStockNoteModels: boolean,
): ModelEnsurer {
  let knownModels: Set<string> | undefined;
  let loadingModels: Promise<Set<string>> | undefined;
  const creatingByName = new Map<string, Promise<void>>();

  async function loadModels(): Promise<Set<string>> {
    if (knownModels !== undefined) {
      return knownModels;
    }

    if (loadingModels === undefined) {
      loadingModels = client.modelNames().then((names) => {
        knownModels = new Set(names);
        return knownModels;
      });
    }

    return loadingModels;
  }

  async function ensureModel(modelName: string): Promise<void> {
    const models = await loadModels();
    if (models.has(modelName)) {
      return;
    }

    const builtinType = builtinTypeForStockModelName(modelName);
    if (!autoCreateStockNoteModels || builtinType === undefined) {
      const hint =
        builtinType !== undefined
          ? " (enable autoCreateStockNoteModels to create stock built-ins)"
          : "";
      throw new Error(`Anki note type not found: ${modelName}${hint}`);
    }

    const inFlight = creatingByName.get(modelName);
    if (inFlight) {
      await inFlight;
      return;
    }

    const createPromise = (async () => {
      await client.createModel(stockModelCreateParams(builtinType));
      models.add(modelName);
    })();

    creatingByName.set(modelName, createPromise);
    try {
      await createPromise;
    } finally {
      creatingByName.delete(modelName);
    }
  }

  return { ensureModel };
}
