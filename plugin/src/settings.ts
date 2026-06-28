import { App, PluginSettingTab, Setting } from 'obsidian';
import type AnkiAstSyncPlugin from './main';

export interface AnkiAstSyncSettings {
	scanFolders: string;
	defaultAnkiDeck: string;
	defaultEngineTag: string;
	ankiConnectUrl: string;
	ankiConnectApiKey: string;
	delimiter: string;
	linkFormat: 'shortest' | 'relative' | 'absolute';
	attachmentFolder: string;
	defaultCardDeclarationHeadingLevel: number;
	includeParentHeadersAsTags: boolean;
	autoCreateDecks: boolean;
}

export const DEFAULT_SETTINGS: AnkiAstSyncSettings = {
	scanFolders: '',
	defaultAnkiDeck: 'Synced from Obsidian',
	defaultEngineTag: 'Obsidian-Anki-AST',
	ankiConnectUrl: 'http://127.0.0.1:8765',
	ankiConnectApiKey: '',
	delimiter: ':::',
	linkFormat: 'shortest',
	attachmentFolder: '',
	defaultCardDeclarationHeadingLevel: 4,
	includeParentHeadersAsTags: true,
	autoCreateDecks: true,
};

export class AnkiAstSyncSettingTab extends PluginSettingTab {
	plugin: AnkiAstSyncPlugin;

	constructor(app: App, plugin: AnkiAstSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('p', {
			text: 'Vault path is taken from the open Obsidian vault. Media uploads use base64 transport (required for browser-based AnkiConnect).',
		});

		containerEl.createEl('p', {
			cls: 'setting-item-description',
			text: 'AnkiConnect CORS: add your Obsidian origin (e.g. app://obsidian.md) to webCorsOriginList in AnkiConnect add-on config. See Docs/Anki-Integration.md in the engine repo.',
		});

		new Setting(containerEl)
			.setName('Scan folders')
			.setDesc('Comma-separated vault folders to scan (leave empty for entire vault).')
			.addText((text) =>
				text
					.setPlaceholder('Notes, 01 - Computer Science')
					.setValue(this.plugin.settings.scanFolders)
					.onChange(async (value) => {
						this.plugin.settings.scanFolders = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Default Anki deck')
			.setDesc('Deck used when a note has no target_anki_deck frontmatter.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.defaultAnkiDeck)
					.onChange(async (value) => {
						this.plugin.settings.defaultAnkiDeck = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Default engine tag')
			.setDesc('Tag applied to every synced note from this plugin.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.defaultEngineTag)
					.onChange(async (value) => {
						this.plugin.settings.defaultEngineTag = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('AnkiConnect URL')
			.setDesc('Local AnkiConnect endpoint.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.ankiConnectUrl)
					.onChange(async (value) => {
						this.plugin.settings.ankiConnectUrl = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('AnkiConnect API key')
			.setDesc('Optional. Must match apiKey in AnkiConnect config when enabled.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.ankiConnectApiKey)
					.onChange(async (value) => {
						this.plugin.settings.ankiConnectApiKey = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Card delimiter')
			.setDesc('Separator between front and back in a card (default :::).')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.delimiter)
					.onChange(async (value) => {
						this.plugin.settings.delimiter = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Link format')
			.setDesc('How wikilinks are resolved when grafting transclusions.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('shortest', 'shortest')
					.addOption('relative', 'relative')
					.addOption('absolute', 'absolute')
					.setValue(this.plugin.settings.linkFormat)
					.onChange(async (value) => {
						this.plugin.settings.linkFormat = value as AnkiAstSyncSettings['linkFormat'];
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Attachment folder')
			.setDesc('Default attachment folder name for media resolution (optional).')
			.addText((text) =>
				text
					.setPlaceholder('attachments')
					.setValue(this.plugin.settings.attachmentFolder)
					.onChange(async (value) => {
						this.plugin.settings.attachmentFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Default card declaration heading level')
			.setDesc('Heading level (1–6) that starts a card when using declaration mode.')
			.addSlider((slider) =>
				slider
					.setLimits(1, 6, 1)
					.setValue(this.plugin.settings.defaultCardDeclarationHeadingLevel)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.defaultCardDeclarationHeadingLevel = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Include parent headers as tags')
			.setDesc('Add heading path segments as Anki tags.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeParentHeadersAsTags)
					.onChange(async (value) => {
						this.plugin.settings.includeParentHeadersAsTags = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Auto-create decks')
			.setDesc('Create missing Anki decks during sync.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCreateDecks)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateDecks = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
