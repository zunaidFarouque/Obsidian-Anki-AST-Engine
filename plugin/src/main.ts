import { Notice, Plugin, addIcon } from 'obsidian';
import { ANKI_SYNC_STAR_ICON_ID, registerPluginIcons } from './icons';
import { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import { registerCardPreview, type CardPreviewManager } from './cardPreview';
import { formatNoteTypeCacheNotice } from './cardPreviewUtils';
import { buildPluginConfig } from './configBuilder';
import { createObsidianFetch } from './obsidianFetch';
import {
	AnkiAstSyncSettingTab,
	DEFAULT_SETTINGS,
	type AnkiAstSyncSettings,
} from './settings';
import { reloadPlugin, reloadPluginCss } from './devReload';
import { runSyncFlow, runSyncFlowForActiveFile } from './syncOrchestrator';

export default class AnkiAstSyncPlugin extends Plugin {
	settings!: AnkiAstSyncSettings;
	cardPreview?: CardPreviewManager;
	private readonly ankiFetch = createObsidianFetch();

	async onload() {
		await this.loadSettings();

		registerPluginIcons(addIcon);

		this.addRibbonIcon(ANKI_SYNC_STAR_ICON_ID, 'Anki AST Sync', () => {
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

		this.addCommand({
			id: 'refresh-note-type-map',
			name: 'Refresh note type cache for preview',
			callback: () => {
				void this.refreshNoteTypeMap();
			},
		});

		this.addCommand({
			id: 'reload-css',
			name: 'Reload CSS',
			callback: () => {
				void this.reloadCss();
			},
		});

		this.addCommand({
			id: 'reload-plugin',
			name: 'Reload plugin',
			callback: () => {
				void this.reloadSelf();
			},
		});

		this.addSettingTab(new AnkiAstSyncSettingTab(this.app, this));

		this.cardPreview = registerCardPreview(this, () => this.settings, () =>
			this.fetchNoteTypeFieldMap(),
		);
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

	private async reloadCss(): Promise<void> {
		const result = await reloadPluginCss(this);
		new Notice(result.message, result.ok ? undefined : 12_000);
	}

	private async reloadSelf(): Promise<void> {
		const result = await reloadPlugin(this);
		new Notice(result.message, result.ok ? undefined : 12_000);
	}

	async refreshNoteTypeMap(): Promise<void> {
		const result =
			(await this.cardPreview?.refreshNoteTypeMap()) ?? {
				ok: false,
				error: 'Card preview is not available.',
			};
		const message = formatNoteTypeCacheNotice(result);
		new Notice(message, result.ok ? undefined : 12_000);
	}

	private async fetchNoteTypeFieldMap(): Promise<Record<string, string[]>> {
		const client = this.createAnkiClient();
		const modelNames = await client.modelNames();
		const map: Record<string, string[]> = {};
		for (const modelName of modelNames) {
			try {
				const fields = await client.invoke<string[]>('modelFieldNames', {
					modelName,
				});
				map[modelName] = fields;
			} catch (error) {
				console.warn(`Unable to fetch fields for note type "${modelName}"`, error);
			}
		}
		return map;
	}
}
