import { Notice, Plugin } from 'obsidian';
import { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import {
	buildExcludedCardKeysFromWarnings,
	runSync,
	summarizeSyncActions,
	type DuplicateWarning,
	type MediaBasenameWarning,
	type SyncAction,
} from 'obsidian-anki-ast-engine/sync';
import { buildPluginConfig } from './configBuilder';
import { createObsidianFetch } from './obsidianFetch';
import { createObsidianVaultAdapter } from './obsidianVaultAdapter';
import {
	AnkiAstSyncSettingTab,
	DEFAULT_SETTINGS,
	type AnkiAstSyncSettings,
} from './settings';
import { showRelinkNotice } from './ui/relinkNotice';
import { VaultDuplicateConflictModal } from './ui/vaultDuplicateConflictModal';

function isVaultCollisionWarning(warning: DuplicateWarning): boolean {
	return (
		warning.kind === 'vault_front_collision' || warning.kind === 'back_mismatch'
	);
}

export default class AnkiAstSyncPlugin extends Plugin {
	settings!: AnkiAstSyncSettings;
	private readonly ankiFetch = createObsidianFetch();

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('layers', 'Anki AST Sync', () => {
			void this.syncVaultToAnki();
		});

		this.addCommand({
			id: 'check-ankiconnect',
			name: 'Check AnkiConnect connection',
			callback: () => {
				void this.checkAnkiConnect();
			},
		});

		this.addCommand({
			id: 'sync-to-anki',
			name: 'Sync vault to Anki',
			callback: () => {
				void this.syncVaultToAnki();
			},
		});

		this.addSettingTab(new AnkiAstSyncSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<AnkiAstSyncSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private createAnkiClient(): AnkiConnectClient {
		return new AnkiConnectClient({
			url: this.settings.ankiConnectUrl,
			apiKey: this.settings.ankiConnectApiKey || undefined,
			fetchImpl: this.ankiFetch,
		});
	}

	private async checkAnkiConnect(): Promise<void> {
		const client = this.createAnkiClient();

		try {
			const version = await client.version();
			new Notice(`AnkiConnect OK (API version ${version})`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`AnkiConnect error: ${message}`, 12000);
			console.error('AnkiConnect check failed:', error);
		}
	}

	private async syncVaultToAnki(): Promise<void> {
		const notice = new Notice('Checking vault for duplicate fronts…', 0);

		try {
			const vault = createObsidianVaultAdapter(this.app);
			const config = buildPluginConfig(this.app, this.settings);
			const preflight = await runSync(config, { dryRun: true, vault });
			const vaultCollisions = preflight.duplicateWarnings.filter(
				isVaultCollisionWarning,
			);

			let excludeCardKeys: ReadonlySet<string> | undefined;
			let syncedDespiteConflicts = false;

			if (vaultCollisions.length > 0) {
				notice.hide();
				const proceed = await VaultDuplicateConflictModal.open(
					this.app,
					vaultCollisions,
				);
				if (!proceed) {
					return;
				}

				excludeCardKeys = buildExcludedCardKeysFromWarnings(vaultCollisions);
				syncedDespiteConflicts = true;
			}

			notice.setMessage('Syncing vault to Anki…');

			const client = this.createAnkiClient();
			const { actions, duplicateWarnings, mediaWarnings } = await runSync(
				config,
				{
					dryRun: false,
					vault,
					forceBase64Media: true,
					ankiClient: client,
					excludeCardKeys,
				},
			);

			const summary = summarizeSyncActions(actions);
			const failed = actions.filter((action) => action.syncError);
			notice.setMessage(
				`Sync complete: added ${summary.added}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}`,
			);
			window.setTimeout(() => notice.hide(), 8000);

			for (const action of failed.slice(0, 3)) {
				new Notice(
					`Sync failed for ${action.file} (${action.tag}): ${action.syncError}`,
					15000,
				);
			}

			this.showDuplicateWarnings(duplicateWarnings, client);
			this.showMediaWarnings(mediaWarnings);

			if (syncedDespiteConflicts) {
				this.showSkippedConflictReminder(actions);
			}
		} catch (error) {
			notice.hide();
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Sync failed: ${message}`, 10000);
			console.error('Sync failed:', error);
		}
	}

	private showSkippedConflictReminder(actions: SyncAction[]): void {
		const skippedCount = actions.filter(
			(action) => action.skipReason === 'vault_duplicate_front',
		).length;

		if (skippedCount === 0) {
			return;
		}

		new Notice(
			`${skippedCount} card(s) skipped due to duplicate fronts — fix conflicts and sync again.`,
			18000,
		);
	}

	private showDuplicateWarnings(
		warnings: DuplicateWarning[],
		client: AnkiConnectClient,
	): void {
		for (const warning of warnings) {
			if (warning.kind === 'anki_duplicate_recovered') {
				showRelinkNotice(this.app, client, warning);
			}
		}
	}

	private showMediaWarnings(warnings: MediaBasenameWarning[]): void {
		for (const warning of warnings) {
			new Notice(`Media: ${warning.message}`, 10000);
		}
	}
}
