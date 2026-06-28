import { relative, resolve } from "node:path";
import type { Config, DeckMapping } from "./config/configParser";
import { scanVault } from "./io/scanner";
import { readMarkdownFile } from "./io/reader";
import { shouldSyncFile, getBodyStartOffset, getCardDeclarationHeadingLevel, getDelimiter, getIncludeParentHeadersAsTags } from "./io/frontmatterFilter";
import { batchInjectIdsIntoFile, buildInjectionPlan } from "./io/surgicalInjector";
import { parseMarkdown } from "./ast/processor";
import { graftTransclusions } from "./ast/transclusionGraft";
import { resolveMedia } from "./ast/mediaResolver";
import { extractCards } from "./parser/stateMachine";
import { compileCardFields } from "./ast/cardCompiler";
import { buildFootnoteScopeIndex } from "./ast/footnoteScopeIndex";
import { buildVaultFileIndex } from "./obsidian/vaultIndex";
import { clearMediaDryRunQueue, uploadMediaPlans } from "./anki/mediaQueue";
import { AnkiConnectError, createAnkiClient } from "./anki/client";
import { syncFileCards, type CardSyncPayload } from "./anki/syncEngine";

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
): Promise<SyncAction[]> {
  clearMediaDryRunQueue();
  const vaultIndex = await buildVaultFileIndex(config.vaultPath);
  const filePaths = await scanVault(config.vaultPath, config.deckMappings);
  const actions: SyncAction[] = [];

  let client = options.dryRun ? undefined : createAnkiClient(config);

  if (!options.dryRun && client) {
    const connected = await client.canConnect();
    if (!connected) {
      throw new AnkiConnectError(
        "Cannot connect to AnkiConnect. Is Anki running with the AnkiConnect add-on enabled?",
      );
    }
  }

  for (const filePath of filePaths) {
    const deck = resolveDeck(filePath, config.vaultPath, config.deckMappings);
    if (!deck) {
      continue;
    }

    const { rawText, absolutePath } = await readMarkdownFile(filePath);
    if (!shouldSyncFile(rawText)) {
      continue;
    }

    const sourcePath = relative(config.vaultPath, absolutePath).replace(
      /\\/g,
      "/",
    );
    const ast = parseMarkdown(rawText, config.vaultPath);
    const unresolvedEmbeds: string[] = [];

    await graftTransclusions(ast, {
      vaultPath: config.vaultPath,
      sourcePath,
      vaultIndex,
      unresolvedEmbeds,
    });

    const mediaResult = await resolveMedia(ast, {
      vaultPath: config.vaultPath,
      sourcePath,
      vaultIndex,
      attachmentFolder: config.attachmentFolder,
      dryRun: options.dryRun,
    });

    const delimiter = getDelimiter(rawText, config.delimiter);
    const declarationLevel = getCardDeclarationHeadingLevel(
      rawText,
      config.defaultCardDeclarationHeadingLevel,
    );
    const bodyStartOffset = getBodyStartOffset(rawText);
    const cards = extractCards(ast, delimiter, {
      bodyStartOffset,
      cardDeclarationHeadingLevel: declarationLevel,
      includeParentHeadersAsTags: getIncludeParentHeadersAsTags(
        rawText,
        config.includeParentHeadersAsTags,
      ),
    });

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

      syncItems.push({
        payload: {
          deck,
          tag: card.tag,
          frontHtml,
          backHtml,
          ankiId: card.ankiId,
          wouldInjectId: injectionPlan?.uuid,
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
      const fileSync = await syncFileCards(client!, syncItems, config);

      for (let index = 0; index < fileActions.length; index += 1) {
        const result = fileSync.results[index];
        const action = fileActions[index]!;
        if (result) {
          action.action = result.action;
          action.ankiNoteId = result.ankiNoteId;
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      for (const action of fileActions) {
        action.syncError = message;
        actions.push(action);
      }
    }
  }

  return actions;
}

export function resolveDeck(
  filePath: string,
  vaultPath: string,
  deckMappings: DeckMapping[],
): string | undefined {
  const absoluteVault = resolve(vaultPath);
  const absoluteFile = resolve(filePath);
  const relativePath = relative(absoluteVault, absoluteFile).replace(/\\/g, "/");

  let bestMatch: DeckMapping | undefined;

  for (const mapping of deckMappings) {
    const folder = mapping.obsidianFolder.replace(/\\/g, "/");
    const inFolder =
      folder === "."
        ? true
        : relativePath === folder || relativePath.startsWith(`${folder}/`);

    if (inFolder && (!bestMatch || folder.length > bestMatch.obsidianFolder.length)) {
      bestMatch = mapping;
    }
  }

  return bestMatch?.ankiDeck;
}
