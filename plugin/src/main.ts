import { Notice, Plugin } from 'obsidian';
import { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import { registerCardPreview, type CardPreviewManager } from './cardPreview';
import { buildPluginConfig } from './configBuilder';
import { createObsidianFetch } from './obsidianFetch';
import {
	AnkiAstSyncSettingTab,
	DEFAULT_SETTINGS,
	type AnkiAstSyncSettings,
} from './settings';
import { runSyncFlow, runSyncFlowForActiveFile } from './syncOrchestrator';

export default class AnkiAstSyncPlugin extends Plugin {
	settings!: AnkiAstSyncSettings;
	cardPreview?: CardPreviewManager;
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

		this.addCommand({
			id: 'dry-run-sync-to-anki',
			name: 'Dry-run sync vault to Anki',
			callback: () => {
				void this.dryRunSyncVaultToAnki();
			},
		});

		this.addCommand({
			id: 'dry-run-sync-current-file',
			name: 'Dry-run sync current note to Anki',
			callback: () => {
				void this.dryRunSyncCurrentFile();
			},
		});

		this.addCommand({
			id: 'sync-current-file-to-anki',
			name: 'Sync current note to Anki',
			callback: () => {
				void this.syncCurrentFileToAnki();
			},
		});

		this.addSettingTab(new AnkiAstSyncSettingTab(this.app, this));

		this.cardPreview = registerCardPreview(this, () => this.settings);
	}

	onunload() {
		this.cardPreview?.destroy();
	}

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

	private syncVaultToAnki(): Promise<void> {
		return runSyncFlow(this.app, this.settings, () => this.createAnkiClient(), {
			dryRun: false,
		});
	}

	private dryRunSyncVaultToAnki(): Promise<void> {
		return runSyncFlow(this.app, this.settings, () => this.createAnkiClient(), {
			dryRun: true,
		});
	}

	private dryRunSyncCurrentFile(): Promise<void> {
		return runSyncFlowForActiveFile(
			this.app,
			this.settings,
			() => this.createAnkiClient(),
			{ dryRun: true },
		);
	}

	private syncCurrentFileToAnki(): Promise<void> {
		return runSyncFlowForActiveFile(
			this.app,
			this.settings,
			() => this.createAnkiClient(),
			{ dryRun: false },
		);
	}
}
