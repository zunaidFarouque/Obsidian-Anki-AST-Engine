import { relative, resolve } from "node:path";
import type { Config } from "./config/configParser";
import { scanVault } from "./io/scanner";
import { readMarkdownFile } from "./io/reader";
import {
  shouldSyncFile,
  getBodyStartOffset,
  getCardDeclarationHeadingLevel,
  getDelimiter,
  getIncludeParentHeadersAsTags,
  getTargetAnkiDeck,
  getFileAnkiTags,
} from "./io/frontmatterFilter";
import { batchInjectIdsIntoFile, buildInjectionPlan, mergeInjectionMetadata } from "./io/surgicalInjector";
import { parseMarkdown } from "./ast/processor";
import { graftTransclusions } from "./ast/transclusionGraft";
import { collectResolvedMediaPaths, resolveMedia } from "./ast/mediaResolver";
import { extractCards } from "./parser/stateMachine";
import { compileCardFields } from "./ast/cardCompiler";
import { buildFootnoteScopeIndex } from "./ast/footnoteScopeIndex";
import { buildVaultFileIndex } from "./obsidian/vaultIndex";
import { clearMediaDryRunQueue, uploadMediaPlans } from "./anki/mediaQueue";
import { AnkiConnectError, createAnkiClient } from "./anki/client";
import { syncFileCards, type CardSyncPayload } from "./anki/syncEngine";
import {
  detectVaultFrontCollisions,
  type DuplicateCardSource,
  type DuplicateWarning,
} from "./anki/duplicateDetect";
import {
  buildAnkiMediaNameMap,
  type MediaBasenameWarning,
} from "./anki/mediaNaming";

export type { DuplicateWarning } from "./anki/duplicateDetect";
export type { MediaBasenameWarning } from "./anki/mediaNaming";

export type SyncAction = {
  action: "add" | "update" | "skip";
  file: string;
  deck: string;
  tag: string;
  frontHtml: string;
  backHtml: string;
  ankiId?: string;
  wouldInjectId?: string;
  ankiNoteId?: number;
  wouldUploadMedia?: string[];
  unresolvedEmbeds?: string[];
  transclusionResolved?: boolean;
  syncError?: string;
};

export type SyncOptions = {
  dryRun: boolean;
};

export type SyncRunResult = {
  actions: SyncAction[];
  duplicateWarnings: DuplicateWarning[];
  mediaWarnings: MediaBasenameWarning[];
};

export type SyncSummary = {
  added: number;
  updated: number;
  skipped: number;
  failed: number;
};

export function summarizeSyncActions(actions: SyncAction[]): SyncSummary {
  const summary: SyncSummary = {
    added: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const action of actions) {
    if (action.syncError) {
      summary.failed += 1;
      continue;
    }

    if (action.action === "add") {
      summary.added += 1;
    } else if (action.action === "update") {
      summary.updated += 1;
    } else {
      summary.skipped += 1;
    }
  }

  return summary;
}

export async function runSync(
  config: Config,
  options: SyncOptions,
): Promise<SyncRunResult> {
  clearMediaDryRunQueue();
  const vaultPath = resolve(config.vaultPath);
  const vaultIndex = await buildVaultFileIndex(vaultPath);
  const filePaths = await scanVault(vaultPath, config.scanFolders);
  const actions: SyncAction[] = [];
  const collisionSources: DuplicateCardSource[] = [];
  const ankiDuplicateWarnings: DuplicateWarning[] = [];

  let client = options.dryRun ? undefined : createAnkiClient(config);

  if (!options.dryRun && client) {
    const connected = await client.canConnect();
    if (!connected) {
      throw new AnkiConnectError(
        "Cannot connect to AnkiConnect. Is Anki running with the AnkiConnect add-on enabled?",
      );
    }
  }

  const phase1MediaEntries = await collectVaultMediaPaths(
    config,
    vaultPath,
    vaultIndex,
    filePaths,
  );
  const { nameByVaultPath, warnings: mediaWarnings } =
    await buildAnkiMediaNameMap(phase1MediaEntries);

  for (const filePath of filePaths) {
    const { rawText, absolutePath } = await readMarkdownFile(filePath);
    if (!shouldSyncFile(rawText)) {
      continue;
    }

    const deck = getTargetAnkiDeck(rawText, config.defaultAnkiDeck);
    const fileAnkiTags = getFileAnkiTags(rawText);

    const sourcePath = relative(vaultPath, absolutePath).replace(
      /\\/g,
      "/",
    );
    const ast = parseMarkdown(rawText, vaultPath);
    const unresolvedEmbeds: string[] = [];

    const delimiter = getDelimiter(rawText, config.delimiter);
    const declarationLevel = getCardDeclarationHeadingLevel(
      rawText,
      config.defaultCardDeclarationHeadingLevel,
    );
    const bodyStartOffset = getBodyStartOffset(rawText);
    const extractOptions = {
      bodyStartOffset,
      cardDeclarationHeadingLevel: declarationLevel,
      includeParentHeadersAsTags: getIncludeParentHeadersAsTags(
        rawText,
        config.includeParentHeadersAsTags,
      ),
    };
    const sourceCards = extractCards(ast, delimiter, extractOptions);

    await graftTransclusions(ast, {
      vaultPath,
      sourcePath,
      vaultIndex,
      attachmentFolder: config.attachmentFolder,
      linkFormat: config.linkFormat,
      unresolvedEmbeds,
    });

    const mediaResult = await resolveMedia(ast, {
      vaultPath,
      sourcePath,
      vaultIndex,
      attachmentFolder: config.attachmentFolder,
      linkFormat: config.linkFormat,
      ankiNameByVaultPath: nameByVaultPath,
      dryRun: options.dryRun,
    });

    const cards = mergeInjectionMetadata(
      extractCards(ast, delimiter, extractOptions),
      sourceCards,
    );

    const footnoteScopeIndex =
      declarationLevel !== undefined
        ? buildFootnoteScopeIndex(ast, declarationLevel, bodyStartOffset)
        : undefined;

    const fileActions: SyncAction[] = [];
    const syncItems: Array<{
      payload: CardSyncPayload;
      injectionOffset?: number;
    }> = [];

    for (const card of cards) {
      const injectionPlan = buildInjectionPlan(card);
      const inheritedFootnoteDefs = footnoteScopeIndex?.resolveForCard(card);
      const { frontHtml, backHtml } = compileCardFields(
        card.frontNodes,
        card.backNodes,
        { inheritedFootnoteDefs },
      );

      const plannedAction: SyncAction["action"] = card.ankiId ? "update" : "add";

      fileActions.push({
        action: plannedAction,
        file: absolutePath,
        deck,
        tag: card.tag,
        frontHtml,
        backHtml,
        ankiId: card.ankiId,
        wouldInjectId: injectionPlan?.uuid,
        wouldUploadMedia: mediaResult.plans.map((plan) => plan.fileName),
        unresolvedEmbeds:
          unresolvedEmbeds.length > 0 ? [...unresolvedEmbeds] : undefined,
        transclusionResolved: unresolvedEmbeds.length === 0,
      });

      collisionSources.push({
        file: absolutePath,
        deck,
        tag: card.tag,
        frontHtml,
        backHtml,
        ankiId: card.ankiId,
      });

      syncItems.push({
        payload: {
          deck,
          tag: card.tag,
          frontHtml,
          backHtml,
          ankiId: card.ankiId,
          wouldInjectId: injectionPlan?.uuid,
          fileAnkiTags,
          sourceFile: absolutePath,
        },
        injectionOffset: injectionPlan?.offset,
      });
    }

    if (options.dryRun || fileActions.length === 0) {
      actions.push(...fileActions);
      continue;
    }

    try {
      await uploadMediaPlans(mediaResult.plans, client!, { concurrency: 3 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      for (const action of fileActions) {
        action.syncError = message;
        actions.push(action);
      }
      continue;
    }

    const fileSync = await syncFileCards(client!, syncItems, config);

    for (let index = 0; index < fileActions.length; index += 1) {
      const result = fileSync.results[index];
      const action = fileActions[index]!;
      if (result) {
        action.action = result.action;
        action.ankiNoteId = result.ankiNoteId;
        if (result.error) {
          action.syncError = result.error;
        }
        if (result.duplicateWarning) {
          ankiDuplicateWarnings.push(result.duplicateWarning);
        }
      }
    }

    if (fileSync.injections.length > 0) {
      await batchInjectIdsIntoFile(
        absolutePath,
        rawText,
        fileSync.injections,
      );
    }

    actions.push(...fileActions);
  }

  return {
    actions,
    duplicateWarnings: [
      ...detectVaultFrontCollisions(collisionSources),
      ...ankiDuplicateWarnings,
    ],
    mediaWarnings,
  };
}

async function collectVaultMediaPaths(
  config: Config,
  vaultPath: string,
  vaultIndex: Awaited<ReturnType<typeof buildVaultFileIndex>>,
  filePaths: string[],
) {
  const entries = [];

  for (const filePath of filePaths) {
    const { rawText, absolutePath } = await readMarkdownFile(filePath);
    if (!shouldSyncFile(rawText)) {
      continue;
    }

    const sourcePath = relative(vaultPath, absolutePath).replace(/\\/g, "/");
    const ast = parseMarkdown(rawText, vaultPath);
    const unresolvedEmbeds: string[] = [];

    await graftTransclusions(ast, {
      vaultPath,
      sourcePath,
      vaultIndex,
      attachmentFolder: config.attachmentFolder,
      linkFormat: config.linkFormat,
      unresolvedEmbeds,
    });

    entries.push(
      ...collectResolvedMediaPaths(ast, {
        vaultPath,
        sourcePath,
        vaultIndex,
        attachmentFolder: config.attachmentFolder,
        linkFormat: config.linkFormat,
      }),
    );
  }

  return entries;
}

