import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import {
	applyOrphanAction,
	buildExcludedCardKeysFromWarnings,
	runSync,
	shouldSyncFile,
	summarizeSyncActions,
	type DuplicateWarning,
	type MediaBasenameWarning,
	type OrphanAction,
	type SyncAction,
	type SyncProgressEvent,
	type VaultOrphan,
} from 'obsidian-anki-ast-engine/sync';
import { buildPluginConfig } from './configBuilder';
import { createObsidianVaultAdapter } from './obsidianVaultAdapter';
import { isOutsideScanFolders } from './scanFolders';
import type { AnkiAstSyncSettings } from './settings';
import { showRelinkNotice } from './ui/relinkNotice';
import { SyncResultsModal } from './ui/syncResultsModal';
import { basename } from './ui/syncDisplayUtils';
import { VaultDuplicateConflictModal } from './ui/vaultDuplicateConflictModal';
import { VaultOrphanModal } from './ui/vaultOrphanModal';

export type RunSyncFlowOptions = {
	dryRun: boolean;
	/** Vault-relative markdown paths to limit the sync pass. */
	files?: string[];
	/** Full-vault duplicate preflight before live sync. Default true for live sync. */
	vaultWidePreflight?: boolean;
};

function isVaultCollisionWarning(warning: DuplicateWarning): boolean {
	return (
		warning.kind === 'vault_front_collision' || warning.kind === 'back_mismatch'
	);
}

function showLiveRelinkWarnings(
	app: App,
	client: AnkiConnectClient,
	warnings: DuplicateWarning[],
): void {
	for (const warning of warnings) {
		if (warning.kind === 'anki_duplicate_recovered') {
			showRelinkNotice(app, client, warning);
		}
	}
}

function logSyncDetails(
	label: string,
	actions: SyncAction[],
	duplicateWarnings: DuplicateWarning[],
	mediaWarnings: MediaBasenameWarning[],
	orphans: VaultOrphan[],
): void {
	console.info(`[Anki AST Sync] ${label}`, {
		actions,
		duplicateWarnings,
		mediaWarnings,
		orphans,
	});
}

function createProgressHandler(
	notice: Notice,
	dryRun: boolean,
	preflight = false,
): (event: SyncProgressEvent) => void {
	return (event) => {
		if (event.phase === 'file') {
			const label = dryRun
				? preflight
					? 'Checking duplicates'
					: 'Dry-running'
				: 'Syncing';
			notice.setMessage(
				`${label} file ${event.current}/${event.total}: ${basename(event.file)}`,
			);
			return;
		}

		if (event.phase === 'media') {
			notice.setMessage(
				dryRun ? 'Preparing dry-run media map…' : 'Preparing media…',
			);
			return;
		}

		if (event.phase === 'orphan') {
			notice.setMessage(event.message);
		}
	};
}

function showSyncResults(
	app: App,
	payload: {
		dryRun: boolean;
		actions: SyncAction[];
		duplicateWarnings: DuplicateWarning[];
		mediaWarnings: MediaBasenameWarning[];
		orphans: VaultOrphan[];
		orphanActions?: OrphanAction[];
		orphanChoice?: 'cancel' | 'ignore' | 'delete' | 'suspend';
		orphanIgnoreTag?: string;
		skippedDuplicateFrontCount?: number;
	},
): void {
	SyncResultsModal.open(app, {
		dryRun: payload.dryRun,
		summary: summarizeSyncActions(payload.actions),
		actions: payload.actions,
		duplicateWarnings: payload.duplicateWarnings,
		mediaWarnings: payload.mediaWarnings,
		orphans: payload.orphans,
		orphanActions: payload.orphanActions,
		orphanChoice: payload.orphanChoice,
		orphanIgnoreTag: payload.orphanIgnoreTag,
		skippedDuplicateFrontCount: payload.skippedDuplicateFrontCount,
	});
}

function shouldDetectOrphans(
	settings: AnkiAstSyncSettings,
	files: string[] | undefined,
): boolean {
	return settings.orphanHandling === 'ask' && !files?.length;
}

export async function runSyncFlow(
	app: App,
	settings: AnkiAstSyncSettings,
	createAnkiClient: () => AnkiConnectClient,
	options: RunSyncFlowOptions,
): Promise<void> {
	const vault = createObsidianVaultAdapter(app);
	const config = buildPluginConfig(app, settings);
	const detectOrphans = shouldDetectOrphans(settings, options.files);
	const progressLabel = options.dryRun ? 'Dry-running sync…' : 'Checking vault for duplicate fronts…';
	const notice = new Notice(progressLabel, 0);

	try {
		if (options.dryRun) {
			notice.setMessage('Dry-running sync…');
			const dryRunClient = detectOrphans ? createAnkiClient() : undefined;
			const { actions, duplicateWarnings, mediaWarnings, orphans } = await runSync(
				config,
				{
					dryRun: true,
					vault,
					files: options.files,
					detectOrphans,
					ankiClient: dryRunClient,
					onProgress: createProgressHandler(notice, true),
				},
			);

			notice.hide();
			showSyncResults(app, {
				dryRun: true,
				actions,
				duplicateWarnings,
				mediaWarnings,
				orphans,
			});
			logSyncDetails('dry-run', actions, duplicateWarnings, mediaWarnings, orphans);
			return;
		}

		const useVaultWidePreflight = options.vaultWidePreflight ?? true;
		let excludeCardKeys: ReadonlySet<string> | undefined;
		let syncedDespiteConflicts = false;

		if (useVaultWidePreflight) {
			const preflight = await runSync(config, {
				dryRun: true,
				vault,
				detectOrphans: false,
				onProgress: createProgressHandler(notice, true, true),
			});
			const vaultCollisions = preflight.duplicateWarnings.filter(
				isVaultCollisionWarning,
			);

			if (vaultCollisions.length > 0) {
				notice.hide();
				const proceed = await VaultDuplicateConflictModal.open(
					app,
					vaultCollisions,
				);
				if (!proceed) {
					return;
				}

				excludeCardKeys = buildExcludedCardKeysFromWarnings(vaultCollisions);
				syncedDespiteConflicts = true;
			}
		}

		notice.setMessage('Syncing vault to Anki…');
		const client = createAnkiClient();
		const { actions, duplicateWarnings, mediaWarnings, orphans } = await runSync(
			config,
			{
				dryRun: false,
				vault,
				files: options.files,
				forceBase64Media: true,
				ankiClient: client,
				excludeCardKeys,
				detectOrphans,
				onProgress: createProgressHandler(notice, false),
			},
		);

		let orphanActions: OrphanAction[] | undefined;
		let orphanChoice: 'cancel' | 'ignore' | 'delete' | 'suspend' | undefined;
		if (detectOrphans && orphans.length > 0) {
			notice.hide();
			orphanChoice = await VaultOrphanModal.open(
				app,
				orphans,
				{
					allowSuspend: settings.orphanAllowSuspend,
					ignoreTag: settings.orphanIgnoreTag,
				},
				client,
			);
			if (
				orphanChoice === 'ignore' ||
				orphanChoice === 'suspend' ||
				orphanChoice === 'delete'
			) {
				const progressMessage =
					orphanChoice === 'ignore'
						? 'Tagging orphaned Anki notes to ignore…'
						: orphanChoice === 'suspend'
							? 'Suspending orphaned Anki notes…'
							: 'Deleting orphaned Anki notes…';
				notice.setMessage(progressMessage);
				orphanActions = await applyOrphanAction(client, orphans, orphanChoice, {
					ignoreTag: settings.orphanIgnoreTag,
				});
			}
		}

		notice.hide();
		showSyncResults(app, {
			dryRun: false,
			actions,
			duplicateWarnings,
			mediaWarnings,
			orphans,
			orphanActions,
			orphanChoice,
			orphanIgnoreTag: settings.orphanIgnoreTag,
			skippedDuplicateFrontCount: syncedDespiteConflicts
				? actions.filter(
						(action) => action.skipReason === 'vault_duplicate_front',
					).length
				: undefined,
		});
		showLiveRelinkWarnings(app, client, duplicateWarnings);
		logSyncDetails('live', actions, duplicateWarnings, mediaWarnings, orphans);
	} catch (error) {
		notice.hide();
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Sync failed: ${message}`, 10000);
		console.error('Sync failed:', error);
	}
}

export async function runSyncFlowForActiveFile(
	app: App,
	settings: AnkiAstSyncSettings,
	createAnkiClient: () => AnkiConnectClient,
	options: Pick<RunSyncFlowOptions, 'dryRun'>,
): Promise<void> {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile || activeFile.extension !== 'md') {
		new Notice('Open a markdown note to sync.', 8000);
		return;
	}

	const vaultPath = activeFile.path;
	const rawText = await app.vault.read(activeFile);
	if (!shouldSyncFile(rawText)) {
		new Notice(
			'This note is not sync-eligible (AnkiSync not enabled).',
			10000,
		);
		return;
	}

	if (isOutsideScanFolders(vaultPath, settings.scanFolders)) {
		new Notice(
			`Syncing "${vaultPath}" even though it is outside configured scan folders.`,
			10000,
		);
	}

	await runSyncFlow(app, settings, createAnkiClient, {
		dryRun: options.dryRun,
		files: [vaultPath],
		vaultWidePreflight: options.dryRun ? false : true,
	});
}
