import { Notice, Plugin } from 'obsidian';
import { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import {
	AnkiAstSyncSettingTab,
	DEFAULT_SETTINGS,
	type AnkiAstSyncSettings,
} from './settings';

export default class AnkiAstSyncPlugin extends Plugin {
	settings!: AnkiAstSyncSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('layers', 'Anki AST Sync', () => {
			void this.checkAnkiConnect();
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
				new Notice(
					'Full vault sync from the plugin is not wired yet. Use the CLI engine for now.',
				);
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

	private async checkAnkiConnect(): Promise<void> {
		const client = new AnkiConnectClient({
			url: this.settings.ankiConnectUrl,
			apiKey: this.settings.ankiConnectApiKey || undefined,
		});

		try {
			const connected = await client.canConnect();
			if (!connected) {
				new Notice('AnkiConnect check failed. Is Anki running?');
				return;
			}

			const version = await client.version();
			new Notice(`AnkiConnect OK (API version ${version})`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`AnkiConnect error: ${message}`);
		}
	}
}
