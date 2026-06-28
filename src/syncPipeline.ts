import { relative, resolve } from "node:path";
import type { Config, DeckMapping } from "./config/configParser";
import { scanVault } from "./io/scanner";
import { readMarkdownFile } from "./io/reader";
import { shouldSyncFile, getBodyStartOffset, getCardDeclarationHeadingLevel, getDelimiter, getIncludeParentHeadersAsTags } from "./io/frontmatterFilter";
import { buildInjectionPlan } from "./io/surgicalInjector";
import { parseMarkdown } from "./ast/processor";
import { graftTransclusions } from "./ast/transclusionGraft";
import { resolveMedia } from "./ast/mediaResolver";
import { extractCards } from "./parser/stateMachine";
import { compileCardFields } from "./ast/cardCompiler";
import { buildFootnoteScopeIndex } from "./ast/footnoteScopeIndex";
import { buildVaultFileIndex } from "./obsidian/vaultIndex";
import { clearMediaDryRunQueue } from "./anki/mediaQueue";

export type SyncAction = {
  action: "add" | "update";
  file: string;
  deck: string;
  tag: string;
  frontHtml: string;
  backHtml: string;
  ankiId?: string;
  wouldInjectId?: string;
  wouldUploadMedia?: string[];
  unresolvedEmbeds?: string[];
  transclusionResolved?: boolean;
};

export type SyncOptions = {
  dryRun: boolean;
};

export async function runSync(
  config: Config,
  options: SyncOptions,
): Promise<SyncAction[]> {
  clearMediaDryRunQueue();
  const vaultIndex = await buildVaultFileIndex(config.vaultPath);
  const filePaths = await scanVault(config.vaultPath, config.deckMappings);
  const actions: SyncAction[] = [];

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

    for (const card of cards) {
      const injectionPlan = buildInjectionPlan(card);
      const inheritedFootnoteDefs = footnoteScopeIndex?.resolveForCard(card);
      const { frontHtml, backHtml } = compileCardFields(
        card.frontNodes,
        card.backNodes,
        { inheritedFootnoteDefs },
      );
      const action: SyncAction = {
        action: card.ankiId ? "update" : "add",
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
      };

      if (!options.dryRun && injectionPlan) {
        // MVP: file write and AnkiConnect dispatch will run here.
      }

      actions.push(action);
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
