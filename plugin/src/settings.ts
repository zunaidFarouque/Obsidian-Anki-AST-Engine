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
	/** Auto-create missing stock Anki note types (Basic, Cloze, …). Opt out to require them in Anki. */
	autoCreateStockNoteModels: boolean;
	noteModelName: string;
	syncTagPrefix: string;
	orphanHandling: 'off' | 'ask';
	orphanIgnoreTag: string;
	orphanAllowSuspend: boolean;
	enableCardPreview: boolean;
	cardPreviewStyle: 'subtle' | 'explicit';
	cardPreviewSyncMarker: 'none' | 'card-emoji' | 'anki-icon';
	/** Fraction of one line height (0–1) to extend card background above section-start headings. */
	cardPreviewSectionTopExtend: number;
	/** Untinted gap before a card that follows another card. CSS: --anki-card-preview-inter-card-gap. */
	cardPreviewInterCardGapEm: number;
	inferClozeFromManualSyntaxOnBasic: boolean;
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
	autoCreateStockNoteModels: true,
	noteModelName: 'Basic',
	syncTagPrefix: 'obsidian-id',
	orphanHandling: 'ask',
	orphanIgnoreTag: 'obsidian-sync-ignore',
	orphanAllowSuspend: false,
	enableCardPreview: false,
	cardPreviewStyle: 'subtle',
	cardPreviewSyncMarker: 'none',
	cardPreviewSectionTopExtend: 0.5,
	cardPreviewInterCardGapEm: 0.28,
	inferClozeFromManualSyntaxOnBasic: false,
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
			text: 'Requires Anki Desktop running with AnkiConnect enabled. The plugin uses Obsidian requestUrl (not browser fetch), so CORS is usually not the blocker — ensure Anki is open and the URL matches your AnkiConnect port.',
		});

		containerEl.createEl('p', {
			cls: 'setting-item-description',
			text: 'If connection still fails: restart Anki after editing AnkiConnect config, confirm http://127.0.0.1:8765 in a browser shows AnkiConnect, and check the developer console (Ctrl+Shift+I) for errors.',
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
						this.plugin.cardPreview?.onSettingsChanged();
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
						this.plugin.cardPreview?.onSettingsChanged();
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
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		containerEl.createEl('h3', { text: 'Live preview' });

		new Setting(containerEl)
			.setName('Card syntax preview')
			.setDesc(
				'Show sync outcome badges on card headings in Live Preview for the active note only. Parsing is debounced and cached so editing stays responsive.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableCardPreview)
					.onChange(async (value) => {
						this.plugin.settings.enableCardPreview = value;
						await this.plugin.saveSettings();
						await this.plugin.syncCardPreviewRegistration();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Infer cloze from {{cN::...}} on basic cards')
			.setDesc(
				'When enabled, manual cloze syntax in the Text region reclassifies basic-resolved cards as cloze in preview and sync (BAS-04).',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.inferClozeFromManualSyntaxOnBasic)
					.onChange(async (value) => {
						this.plugin.settings.inferClozeFromManualSyntaxOnBasic = value;
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Card preview style')
			.setDesc('Choose subtle or explicit preview emphasis.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('subtle', 'subtle')
					.addOption('explicit', 'explicit')
					.setValue(this.plugin.settings.cardPreviewStyle)
					.onChange(async (value) => {
						this.plugin.settings.cardPreviewStyle =
							value as AnkiAstSyncSettings['cardPreviewStyle'];
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Card preview sync marker')
			.setDesc('Choose optional visual marker for sync state.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('none', 'none')
					.addOption('card-emoji', 'card-emoji')
					.addOption('anki-icon', 'anki-icon')
					.setValue(this.plugin.settings.cardPreviewSyncMarker)
					.onChange(async (value) => {
						this.plugin.settings.cardPreviewSyncMarker =
							value as AnkiAstSyncSettings['cardPreviewSyncMarker'];
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Section top background extend')
			.setDesc(
				'Fraction of a line height (0–1) to extend the card tint upward when the card follows a shallower section heading (e.g. ### then ####). 0 disables. CSS: --anki-card-preview-section-top-extend.',
			)
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.05)
					.setValue(this.plugin.settings.cardPreviewSectionTopExtend)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.cardPreviewSectionTopExtend = value;
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Gap between card blocks')
			.setDesc(
				'Untinted space before a card that follows another card (em). CSS override: --anki-card-preview-inter-card-gap in a snippet.',
			)
			.addSlider((slider) =>
				slider
					.setLimits(0, 0.8, 0.05)
					.setValue(this.plugin.settings.cardPreviewInterCardGapEm)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.cardPreviewInterCardGapEm = value;
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Refresh note type cache')
			.setDesc('Recache note type names/fields from AnkiConnect for preview validation.')
			.addButton((button) =>
				button.setButtonText('Refresh').onClick(async () => {
					await this.plugin.refreshNoteTypeMap();
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

		new Setting(containerEl)
			.setName('Auto-create stock note types')
			.setDesc(
				'Create missing stock Anki note types (Basic, Cloze, Basic (and reversed card), Basic (type in the answer)) during sync. Turn off to require them already in Anki.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCreateStockNoteModels)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateStockNoteModels = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl('h3', { text: 'Advanced' });

		new Setting(containerEl)
			.setName('Note model name')
			.setDesc('Anki note type for new cards. Only Basic is supported by the engine today.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.noteModelName)
					.onChange(async (value) => {
						this.plugin.settings.noteModelName = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Obsidian ID tag prefix')
			.setDesc('Prefix for obsidian-id::uuid tags that bind vault cards to Anki notes.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.syncTagPrefix)
					.onChange(async (value) => {
						this.plugin.settings.syncTagPrefix = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Orphan handling')
			.setDesc(
				'On full-vault live sync, prompt to ignore or delete Anki notes whose vault UUID no longer appears in the scan. Single-file sync never prompts. Set to Off to skip detection for speed.',
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('ask', 'Ask each sync')
					.addOption('off', 'Off')
					.setValue(this.plugin.settings.orphanHandling)
					.onChange(async (value) => {
						this.plugin.settings.orphanHandling = value as AnkiAstSyncSettings['orphanHandling'];
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Allow suspend for orphan notes')
			.setDesc(
				'When enabled, the orphan modal also offers Suspend (hide cards from review). Default actions are Cancel, Ignore, and Delete.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.orphanAllowSuspend)
					.onChange(async (value) => {
						this.plugin.settings.orphanAllowSuspend = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Orphan ignore tag')
			.setDesc(
				'Anki tag added when you choose Ignore on orphaned notes. Tagged notes are skipped on future syncs but remain active in Anki.',
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.orphanIgnoreTag)
					.onChange(async (value) => {
						this.plugin.settings.orphanIgnoreTag = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
