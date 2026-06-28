import { Notice, Plugin } from 'obsidian';
import { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import {
	runSync,
	summarizeSyncActions,
	type DuplicateWarning,
	type MediaBasenameWarning,
} from 'obsidian-anki-ast-engine/sync';
import { buildPluginConfig } from './configBuilder';
import { createObsidianFetch } from './obsidianFetch';
import { createObsidianVaultAdapter } from './obsidianVaultAdapter';
import {
	AnkiAstSyncSettingTab,
	DEFAULT_SETTINGS,
	type AnkiAstSyncSettings,
} from './settings';

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
		const notice = new Notice('Syncing vault to Anki…', 0);

		try {
			const vault = createObsidianVaultAdapter(this.app);
			const config = buildPluginConfig(this.app, this.settings);
			const { actions, duplicateWarnings, mediaWarnings } = await runSync(
				config,
				{
					dryRun: false,
					vault,
					forceBase64Media: true,
					ankiClient: this.createAnkiClient(),
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

			this.showDuplicateWarnings(duplicateWarnings);
			this.showMediaWarnings(mediaWarnings);
		} catch (error) {
			notice.hide();
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Sync failed: ${message}`, 10000);
			console.error('Sync failed:', error);
		}
	}

	private showDuplicateWarnings(warnings: DuplicateWarning[]): void {
		for (const warning of warnings) {
			const label =
				warning.kind === 'back_mismatch'
					? 'Duplicate front with different backs'
					: warning.kind === 'vault_front_collision'
						? 'Duplicate front collision'
						: 'Anki duplicate recovered';
			new Notice(`${label}: ${warning.message}`, 12000);
		}
	}

	private showMediaWarnings(warnings: MediaBasenameWarning[]): void {
		for (const warning of warnings) {
			new Notice(`Media: ${warning.message}`, 10000);
		}
	}
}
