import { joinPath } from "./utils/pathUtils";
import type { Config } from "./config/configParser";
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
import { parseCardDocument } from "./cardSyntax/parseCardDocument";
import {
  collectPreviewWarnings,
  effectiveCardOutcome,
  isAnkiWriteAllowed,
} from "./cardSyntax/syncEligibility";
import type { ResolvedCard, SyncOutcome } from "./cardSyntax/types";
import { buildFootnoteScopeIndex } from "./ast/footnoteScopeIndex";
import { buildVaultFileIndex } from "./obsidian/vaultIndex";
import { clearMediaDryRunQueue, uploadMediaPlans } from "./anki/mediaQueue";
import { AnkiConnectError, AnkiConnectClient } from "./anki/client";
import {
  syncFileCards,
  createSyncRunContext,
  buildAnkiTags,
  buildObsidianIdTag,
  assessModelMigration,
  type CardSyncPayload,
  type TypeMigrationInfo,
} from "./anki/syncEngine";
import { planNoteModelForResolvedType } from "./anki/stockNoteModels";
import { normalizeSyncFieldHtml } from "./anki/frontSearch";
import {
  cardExclusionKey,
  detectVaultFrontCollisions,
  type DuplicateCardSource,
  type DuplicateWarning,
} from "./anki/duplicateDetect";
import {
  buildAnkiMediaNameMap,
  type MediaBasenameWarning,
} from "./anki/mediaNaming";
import type { VaultAdapter } from "./io/vaultAdapter";
import { toActionFilePath } from "./io/vaultAdapter";
import { createNodeVaultAdapter } from "./io/nodeVaultAdapter";
import {
  detectVaultOrphans,
  type VaultOrphan,
} from "./anki/orphanDetect";

export type { DuplicateWarning } from "./anki/duplicateDetect";
export {
  buildExcludedCardKeysFromWarnings,
  cardExclusionKey,
} from "./anki/duplicateDetect";
export { stripHtmlForSearch } from "./anki/frontSearch";
export { shouldSyncFile } from "./io/frontmatterFilter";
export type { MediaBasenameWarning } from "./anki/mediaNaming";
export type { VaultAdapter } from "./io/vaultAdapter";
export type { VaultOrphan } from "./anki/orphanDetect";
export type { OrphanAction } from "./anki/orphanHandler";
export { applyOrphanAction } from "./anki/orphanHandler";
export { detectVaultOrphans } from "./anki/orphanDetect";

export type SyncProgressEvent =
  | { phase: "media"; message: string }
  | { phase: "file"; current: number; total: number; file: string }
  | { phase: "orphan"; message: string };

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
  mediaUploadDetails?: Array<{
    fileName: string;
    transport: "path" | "base64" | "url";
  }>;
  unresolvedEmbeds?: string[];
  transclusionResolved?: boolean;
  syncError?: string;
  skipReason?: "vault_duplicate_front" | "preview_skip" | "preview_error";
  /** Effective cardSyntax outcome (sync/skip/warn/error) used for the write gate. */
  previewOutcome?: SyncOutcome;
  /** Warn-level messages when sync proceeds despite warnings (01 D3). */
  previewWarnings?: string[];
  /** Built-in / custom resolved type for type-mix summaries (Phase 2c). */
  resolvedType?: "basic" | "cloze" | "reversible" | "typed" | "custom";
  /** Target Anki model name for this card. */
  modelName?: string;
  typeMigration?: TypeMigrationInfo;
  modelMismatchWarning?: string;
};

export type SyncOptions = {
  dryRun: boolean;
  vault?: VaultAdapter;
  forceBase64Media?: boolean;
  ankiClient?: AnkiConnectClient;
  /** Obsidian plugin should pass createObsidianFetch() to avoid browser CORS. */
  fetchImpl?: typeof fetch;
  excludeCardKeys?: ReadonlySet<string>;
  /** Vault-relative markdown paths to limit sync scope. */
  files?: string[];
  onProgress?: (event: SyncProgressEvent) => void;
  /** Full-vault orphan detection (requires AnkiConnect). Skipped when `files` is set. */
  detectOrphans?: boolean;
};

export type SyncRunResult = {
  actions: SyncAction[];
  duplicateWarnings: DuplicateWarning[];
  mediaWarnings: MediaBasenameWarning[];
  orphans: VaultOrphan[];
};

export type SyncTypeMixSummary = {
  basic: number;
  cloze: number;
  reversible: number;
  typed: number;
  custom: number;
  total: number;
};

export type SyncSummary = {
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Vault type ≠ Anki model; fields updated in place (02 D6). */
  typeMigrated: number;
  /** Vault type ≠ Anki model; write blocked (incompatible fields). */
  modelMismatchBlocked: number;
  typeMix: SyncTypeMixSummary;
};

export function summarizeSyncTypeMix(actions: SyncAction[]): SyncTypeMixSummary {
  const mix: SyncTypeMixSummary = {
    basic: 0,
    cloze: 0,
    reversible: 0,
    typed: 0,
    custom: 0,
    total: 0,
  };

  for (const action of actions) {
    const type = action.resolvedType;
    if (!type) {
      continue;
    }
    mix[type] += 1;
    mix.total += 1;
  }

  return mix;
}

export function formatSyncTypeMixLine(mix: SyncTypeMixSummary): string {
  const parts: string[] = [];
  if (mix.basic > 0) parts.push(`basic ${mix.basic}`);
  if (mix.cloze > 0) parts.push(`cloze ${mix.cloze}`);
  if (mix.reversible > 0) parts.push(`reversible ${mix.reversible}`);
  if (mix.typed > 0) parts.push(`typed ${mix.typed}`);
  if (mix.custom > 0) parts.push(`custom ${mix.custom}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

export function summarizeSyncActions(actions: SyncAction[]): SyncSummary {
  const summary: SyncSummary = {
    added: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    typeMigrated: 0,
    modelMismatchBlocked: 0,
    typeMix: summarizeSyncTypeMix(actions),
  };

  for (const action of actions) {
    if (action.typeMigration?.status === "fields_updated_model_unchanged") {
      summary.typeMigrated += 1;
    }
    if (action.typeMigration?.status === "blocked_incompatible_fields") {
      summary.modelMismatchBlocked += 1;
    }

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

function resolveVaultAdapter(config: Config, options: SyncOptions): VaultAdapter {
  return options.vault ?? createNodeVaultAdapter(config.vaultPath);
}

function entryAbsolutePath(
  vault: VaultAdapter,
  vaultRelativePath: string,
): string {
  return joinPath(vault.vaultRoot, vaultRelativePath);
}

function normalizeVaultRelativePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function filterFilePaths(
  filePaths: string[],
  files: string[] | undefined,
): string[] {
  if (!files || files.length === 0) {
    return filePaths;
  }

  const allowed = new Set(files.map(normalizeVaultRelativePath));
  return filePaths.filter((path) =>
    allowed.has(normalizeVaultRelativePath(path)),
  );
}

type SyncEligibleFile = {
  sourcePath: string;
  rawText: string;
};

async function loadSyncEligibleFiles(
  vault: VaultAdapter,
  filePaths: string[],
): Promise<SyncEligibleFile[]> {
  const eligible: SyncEligibleFile[] = [];

  for (const sourcePath of filePaths) {
    const rawText = await vault.readText(sourcePath);
    if (shouldSyncFile(rawText)) {
      eligible.push({ sourcePath, rawText });
    }
  }

  return eligible;
}

function trackVaultBoundUuid(
  vaultBoundUuids: Set<string>,
  uuid: string | undefined,
): void {
  if (uuid) {
    vaultBoundUuids.add(uuid);
  }
}

function dryRunTagsChanged(currentTags: string[], nextTags: string[]): boolean {
  const current = [...currentTags].sort();
  const next = [...nextTags].sort();
  if (current.length !== next.length) {
    return true;
  }
  return current.some((tag, index) => tag !== next[index]);
}

function dryRunFieldsChanged(
  noteFields: Record<string, { value: string; order: number }>,
  fields: Record<string, string>,
): boolean {
  for (const [key, value] of Object.entries(fields)) {
    const current = normalizeSyncFieldHtml(noteFields[key]?.value ?? "");
    if (current !== normalizeSyncFieldHtml(value)) {
      return true;
    }
  }
  return false;
}

async function applyDryRunParity(
  client: AnkiConnectClient,
  config: Config,
  entries: Array<{ payload: CardSyncPayload; action: SyncAction }>,
): Promise<void> {
  const syncTagPrefix = config.syncTagPrefix ?? "obsidian-id";
  const engineTag = config.defaultEngineTag ?? "Obsidian-Anki-AST";

  for (const entry of entries) {
    const uuid = entry.payload.ankiId ?? entry.payload.wouldInjectId;
    if (!uuid) {
      continue;
    }

    const tags = buildAnkiTags({
      engineTag,
      fileTags: entry.payload.fileAnkiTags ?? [],
      headingTag: entry.payload.tag,
      syncTagPrefix,
      uuid,
    });
    const noteIds = await client.findNotes(
      `tag:"${buildObsidianIdTag(syncTagPrefix, uuid)}"`,
    );
    if (noteIds.length !== 1) {
      continue;
    }

    const [noteInfo] = await client.notesInfo([noteIds[0]!]);
    if (!noteInfo) {
      continue;
    }

    entry.action.ankiNoteId = noteInfo.noteId;
    const fields =
      entry.payload.fields ??
      ({
        Front: entry.payload.frontHtml,
        Back: entry.payload.backHtml,
      } satisfies Record<string, string>);
    const targetModel =
      entry.payload.modelName ?? config.noteModelName ?? "Basic";
    const migration = assessModelMigration(noteInfo, targetModel, fields);

    if (migration.kind === "incompatible") {
      entry.action.action = "skip";
      entry.action.syncError = migration.error;
      entry.action.typeMigration = migration.typeMigration;
      entry.action.modelMismatchWarning = migration.warning;
      continue;
    }

    if (migration.kind === "compatible") {
      entry.action.typeMigration = migration.typeMigration;
      entry.action.modelMismatchWarning = migration.warning;
    }

    entry.action.action = dryRunFieldsChanged(noteInfo.fields, fields) ||
      dryRunTagsChanged(noteInfo.tags, tags)
      ? "update"
      : "skip";
  }
}

export async function runSync(
  config: Config,
  options: SyncOptions,
): Promise<SyncRunResult> {
  clearMediaDryRunQueue();
  const vault = resolveVaultAdapter(config, options);
  const vaultPath = vault.vaultRoot;
  const vaultIndex = await buildVaultFileIndex(vault);
  const filePaths = filterFilePaths(
    await vault.listMarkdownFiles(config.scanFolders),
    options.files,
  );

  if (filePaths.length === 0) {
    return {
      actions: [],
      duplicateWarnings: [],
      mediaWarnings: [],
      orphans: [],
    };
  }

  const eligibleFiles = await loadSyncEligibleFiles(vault, filePaths);
  const syncEligibleTotal = eligibleFiles.length;
  const vaultBoundUuids = new Set<string>();

  const actions: SyncAction[] = [];
  const collisionSources: DuplicateCardSource[] = [];
  const ankiDuplicateWarnings: DuplicateWarning[] = [];

  const shouldDetectOrphans =
    (options.detectOrphans ?? !options.dryRun) && !options.files;
  let orphanClient = options.ankiClient;
  if (shouldDetectOrphans && !orphanClient) {
    orphanClient = new AnkiConnectClient({
      url: config.ankiConnectUrl,
      apiKey: config.ankiConnectApiKey,
      fetchImpl: options.fetchImpl,
    });
  }

  const client = options.ankiClient ??
    (options.dryRun
      ? undefined
      :
      new AnkiConnectClient({
        url: config.ankiConnectUrl,
        apiKey: config.ankiConnectApiKey,
        fetchImpl: options.fetchImpl,
      }));
  let syncContext: ReturnType<typeof createSyncRunContext> | undefined;

  if (!options.dryRun && client) {
    const connected = await client.canConnect();
    if (!connected) {
      throw new AnkiConnectError(
        "Cannot connect to AnkiConnect. Is Anki running with the AnkiConnect add-on enabled?",
      );
    }
    syncContext = createSyncRunContext(client, config);
  }

  options.onProgress?.({ phase: "media", message: "Preparing media…" });

  const phase1MediaEntries = await collectVaultMediaPaths(
    config,
    vault,
    vaultIndex,
    eligibleFiles,
  );
  const { nameByVaultPath, warnings: mediaWarnings } =
    await buildAnkiMediaNameMap(phase1MediaEntries, vault);

  let fileProgressCurrent = 0;
  for (const { sourcePath, rawText } of eligibleFiles) {
    fileProgressCurrent += 1;
    options.onProgress?.({
      phase: "file",
      current: fileProgressCurrent,
      total: syncEligibleTotal,
      file: sourcePath,
    });

    const deck = getTargetAnkiDeck(rawText, config.defaultAnkiDeck);
    const fileAnkiTags = getFileAnkiTags(rawText);
    const actionFile = toActionFilePath(vault, sourcePath);
    const ast = parseMarkdown(rawText, vaultPath);
    const unresolvedEmbeds: string[] = [];

    const delimiter = getDelimiter(rawText, config.delimiter);
    const declarationLevel = getCardDeclarationHeadingLevel(
      rawText,
      config.defaultCardDeclarationHeadingLevel,
    );
    const bodyStartOffset = getBodyStartOffset(rawText);
    const includeParentHeadersAsTags = getIncludeParentHeadersAsTags(
      rawText,
      config.includeParentHeadersAsTags,
    );
    const extractOptions = {
      bodyStartOffset,
      cardDeclarationHeadingLevel: declarationLevel,
      includeParentHeadersAsTags,
    };
    const sourceCards = extractCards(ast, delimiter, extractOptions);

    const previewDocument = parseCardDocument(rawText, {
      cardDeclarationHeadingLevel: declarationLevel,
      delimiter,
      bodyStartOffset,
      includeParentHeadersAsTags,
      inferClozeFromManualSyntaxOnBasic:
        config.inferClozeFromManualSyntaxOnBasic,
      noteTypeFieldNamesByNoteType: {},
    });
    const previewByOrdinal = previewCardsByOrdinal(previewDocument.cards);

    await graftTransclusions(ast, {
      vaultPath,
      sourcePath,
      vaultIndex,
      vault,
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
      forceBase64Media: options.forceBase64Media,
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
      action: SyncAction;
    }> = [];

    for (const [cardIndex, card] of cards.entries()) {
      const injectionPlan = buildInjectionPlan(card);
      trackVaultBoundUuid(vaultBoundUuids, card.ankiId);
      trackVaultBoundUuid(vaultBoundUuids, injectionPlan?.uuid);
      const inheritedFootnoteDefs = footnoteScopeIndex?.resolveForCard(card);
      const { frontHtml, backHtml } = compileCardFields(
        card.frontNodes,
        card.backNodes,
        { inheritedFootnoteDefs },
      );

      const previewCard =
        previewByOrdinal.get(card.ordinal) ??
        previewDocument.cards[cardIndex];
      const previewOutcome = previewCard
        ? effectiveCardOutcome(previewCard)
        : undefined;
      const previewWarnings = previewCard
        ? collectPreviewWarnings(previewCard)
        : undefined;
      const notePlan = planNoteModelForResolvedType(
        previewCard?.resolvedType,
        frontHtml,
        backHtml,
        config.noteModelName,
      );
      const customNotImplemented = notePlan.kind === "custom";
      const writeBlocked =
        (previewOutcome !== undefined && !isAnkiWriteAllowed(previewOutcome)) ||
        customNotImplemented;
      const previewSkipReason:
        | "preview_skip"
        | "preview_error"
        | undefined = writeBlocked
        ? customNotImplemented
          ? "preview_skip"
          : previewOutcome === "error"
            ? "preview_error"
            : "preview_skip"
        : undefined;

      const exclusionKey = cardExclusionKey(
        actionFile,
        card.tag,
        deck,
        frontHtml,
      );
      const isExcluded = options.excludeCardKeys?.has(exclusionKey) ?? false;
      const plannedAction: SyncAction["action"] =
        isExcluded || writeBlocked
          ? "skip"
          : card.ankiId
            ? "update"
            : "add";

      const mergedPreviewWarnings = [
        ...(previewWarnings ?? []),
        ...(customNotImplemented ? [notePlan.notImplementedMessage] : []),
      ];

      const fileAction: SyncAction = {
        action: plannedAction,
        file: actionFile,
        deck,
        tag: card.tag,
        frontHtml,
        backHtml:
          notePlan.kind === "builtin" && notePlan.builtinType === "typed"
            ? notePlan.fields.Back
            : backHtml,
        ankiId: card.ankiId,
        wouldInjectId:
          isExcluded || writeBlocked ? undefined : injectionPlan?.uuid,
        wouldUploadMedia: mediaResult.plans.map((plan) => plan.fileName),
        mediaUploadDetails: mediaResult.plans.map((plan) => ({
          fileName: plan.fileName,
          transport: plan.transport,
        })),
        unresolvedEmbeds:
          unresolvedEmbeds.length > 0 ? [...unresolvedEmbeds] : undefined,
        transclusionResolved: unresolvedEmbeds.length === 0,
        skipReason: isExcluded
          ? "vault_duplicate_front"
          : previewSkipReason,
        previewOutcome,
        previewWarnings:
          mergedPreviewWarnings.length > 0
            ? mergedPreviewWarnings
            : undefined,
        syncError: customNotImplemented
          ? notePlan.notImplementedMessage
          : undefined,
        resolvedType:
          notePlan.kind === "custom"
            ? "custom"
            : notePlan.kind === "builtin"
              ? notePlan.builtinType
              : "basic",
        modelName:
          notePlan.kind === "custom" ? undefined : notePlan.modelName,
      };
      fileActions.push(fileAction);

      collisionSources.push({
        file: actionFile,
        deck,
        tag: card.tag,
        frontHtml,
        backHtml,
        ankiId: card.ankiId,
      });

      if (isExcluded || writeBlocked) {
        continue;
      }

      if (notePlan.kind === "custom") {
        continue;
      }

      syncItems.push({
        payload: {
          deck,
          tag: card.tag,
          frontHtml,
          backHtml,
          modelName: notePlan.modelName,
          fields: notePlan.fields,
          ankiId: card.ankiId,
          wouldInjectId: injectionPlan?.uuid,
          fileAnkiTags,
          sourceFile: actionFile,
        },
        injectionOffset: injectionPlan?.offset,
        action: fileAction,
      });
    }

    if (options.dryRun) {
      if (client && syncItems.length > 0) {
        try {
          await applyDryRunParity(client, config, syncItems);
        } catch (error) {
          console.warn(
            "[Anki AST Sync] Dry-run parity fallback to planned actions:",
            error,
          );
        }
      }
      actions.push(...fileActions);
      continue;
    }

    if (fileActions.length === 0) {
      actions.push(...fileActions);
      continue;
    }

    if (syncItems.length === 0) {
      actions.push(...fileActions);
      continue;
    }

    try {
      await uploadMediaPlans(mediaResult.plans, client!, {
        concurrency: 3,
        vault,
        forceBase64Media: options.forceBase64Media,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      for (const action of fileActions) {
        action.syncError = message;
        actions.push(action);
      }
      continue;
    }

    const fileSync = await syncFileCards(client!, syncItems, config, syncContext);

    let syncResultIndex = 0;
    for (const action of fileActions) {
      if (
        action.skipReason === "vault_duplicate_front" ||
        action.skipReason === "preview_skip" ||
        action.skipReason === "preview_error"
      ) {
        continue;
      }

      const result = fileSync.results[syncResultIndex];
      syncResultIndex += 1;
      if (result) {
        action.action = result.action;
        action.ankiNoteId = result.ankiNoteId;
        if (result.error) {
          action.syncError = result.error;
        }
        if (result.typeMigration) {
          action.typeMigration = result.typeMigration;
        }
        if (result.modelMismatchWarning) {
          action.modelMismatchWarning = result.modelMismatchWarning;
          const warnings = action.previewWarnings ?? [];
          if (!warnings.includes(result.modelMismatchWarning)) {
            action.previewWarnings = [
              ...warnings,
              result.modelMismatchWarning,
            ];
          }
        }
        if (result.duplicateWarning) {
          ankiDuplicateWarnings.push(result.duplicateWarning);
          trackVaultBoundUuid(
            vaultBoundUuids,
            result.duplicateWarning.linkedObsidianId,
          );
        }
      }
    }

    if (fileSync.injections.length > 0) {
      await batchInjectIdsIntoFile(
        sourcePath,
        rawText,
        fileSync.injections,
        vault,
      );
    }

    actions.push(...fileActions);
  }

  let orphans: VaultOrphan[] = [];
  if (shouldDetectOrphans && orphanClient) {
    options.onProgress?.({
      phase: "orphan",
      message: "Checking for orphaned Anki notes…",
    });
    try {
      orphans = await detectVaultOrphans({
        client: orphanClient,
        config,
        vaultBoundUuids,
      });
    } catch (error) {
      if (!options.dryRun) {
        throw error;
      }
      console.warn(
        "[Anki AST Sync] Orphan detection skipped during dry-run:",
        error,
      );
    }
  }

  return {
    actions,
    duplicateWarnings: [
      ...detectVaultFrontCollisions(collisionSources),
      ...ankiDuplicateWarnings,
    ],
    mediaWarnings,
    orphans,
  };
}

function previewCardsByOrdinal(
  cards: ResolvedCard[],
): Map<number, ResolvedCard> {
  const byOrdinal = new Map<number, ResolvedCard>();
  for (const card of cards) {
    byOrdinal.set(card.ordinal, card);
  }
  return byOrdinal;
}

async function collectVaultMediaPaths(
  config: Config,
  vault: VaultAdapter,
  vaultIndex: Awaited<ReturnType<typeof buildVaultFileIndex>>,
  eligibleFiles: SyncEligibleFile[],
) {
  const entries = [];

  for (const { sourcePath, rawText } of eligibleFiles) {
    const ast = parseMarkdown(rawText, vault.vaultRoot);
    const unresolvedEmbeds: string[] = [];

    await graftTransclusions(ast, {
      vaultPath: vault.vaultRoot,
      sourcePath,
      vaultIndex,
      vault,
      attachmentFolder: config.attachmentFolder,
      linkFormat: config.linkFormat,
      unresolvedEmbeds,
    });

    entries.push(
      ...collectResolvedMediaPaths(ast, {
        vaultPath: vault.vaultRoot,
        sourcePath,
        vaultIndex,
        attachmentFolder: config.attachmentFolder,
        linkFormat: config.linkFormat,
      }).map((entry) => ({
        ...entry,
        absolutePath: entryAbsolutePath(vault, entry.vaultRelativePath),
      })),
    );
  }

  return entries;
}
