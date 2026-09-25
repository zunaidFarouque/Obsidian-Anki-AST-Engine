import { App, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
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
	syncTagPrefix: string;
	orphanHandling: 'off' | 'ask';
	orphanIgnoreTag: string;
	orphanAllowSuspend: boolean;
	enableCardPreview: boolean;
	/** @deprecated Cosmetic preview mode placeholder. */
	cardPreviewStyle: 'subtle' | 'explicit';
	/** Visual emphasis on the card declaration heading line: uniform with body (off), slightly heavier tint (shaded), or heavier tint with hairline separator (divided). */
	cardPreviewHeadingStyle: 'off' | 'shaded' | 'divided';
	/** @deprecated Cosmetic sync marker placeholder. */
	cardPreviewSyncMarker: 'none' | 'card-emoji' | 'anki-icon';
	/** Fraction of one line height (0–1) to extend card background above section-start headings. */
	cardPreviewSectionTopExtend: number;
	/** Untinted gap before a card that follows another card. CSS: --anki-card-preview-inter-card-gap. */
	cardPreviewInterCardGapEm: number;
	inferClozeFromManualSyntaxOnBasic: boolean;
	customLayoutMap: Record<string, [string, string]>;
	/** Folder path where "Create new Anki note" places new files. Empty = Obsidian default. */
	newNoteFolder: string;
	/** Whether to automatically insert a starter card when creating a new Anki note. */
	newNoteInsertStarterCard: boolean;
	/** Default target Anki deck for newly created notes. Empty = defaultAnkiDeck. */
	newNoteDefaultDeck: string;
	/** Auto-increment cloze index (c1, c2, c3...) within the current card. */
	clozeAutoIncrement: boolean;
	/** Generate shorthand cloze format ({{...}}) instead of standard ({{c1::...}}). */
	clozeDefaultToShorthand: boolean;
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
	syncTagPrefix: 'obsidian-id',
	orphanHandling: 'ask',
	orphanIgnoreTag: 'obsidian-sync-ignore',
	orphanAllowSuspend: false,
	enableCardPreview: false,
	cardPreviewStyle: 'subtle',
	cardPreviewHeadingStyle: 'off',
	cardPreviewSyncMarker: 'none',
	cardPreviewSectionTopExtend: 0.5,
	cardPreviewInterCardGapEm: 0.28,
	inferClozeFromManualSyntaxOnBasic: false,
	customLayoutMap: {},
	newNoteFolder: '',
	newNoteInsertStarterCard: true,
	newNoteDefaultDeck: '',
	clozeAutoIncrement: true,
	clozeDefaultToShorthand: false,
};

export class AnkiAstSyncSettingTab extends PluginSettingTab {
	plugin: AnkiAstSyncPlugin;

	constructor(app: App, plugin: AnkiAstSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Banner Intro
		const banner = containerEl.createDiv({ cls: 'anki-ast-settings-banner' });
		banner.createDiv({
			cls: 'anki-ast-settings-banner-title',
			text: 'Anki AST sync',
		});
		banner.createEl('p', {
			cls: 'anki-ast-settings-banner-desc',
			text: 'Welcome to Anki AST sync. This plugin reads the semantic structure of your Markdown notes to synchronize flashcards to Anki desktop without modifying your note formatting or layout. To get started: ensure Anki desktop is running, test your connection below, and add AnkiSync: on to any note frontmatter.',
		});

		// ----------------------------------------------------------------------
		// 1. AnkiConnect Connection
		// ----------------------------------------------------------------------
		new Setting(containerEl).setName('AnkiConnect connection').setHeading();

		const connCallout = containerEl.createDiv({ cls: 'anki-ast-settings-callout' });
		connCallout.createEl('p', {
			text: 'Requires Anki desktop running locally with the AnkiConnect add-on enabled (code: 2055492159).',
		});

		const corsDetails = connCallout.createEl('details');
		corsDetails.createEl('summary', { text: 'CORS configuration and troubleshooting guide' });
		const corsHelp = corsDetails.createDiv();
		corsHelp.createEl('p', {
			text: 'The plugin makes requests through Obsidian, so CORS is typically bypassed. However, if connection fails, update AnkiConnect configuration in Anki under tools → add-ons → AnkiConnect → config:',
		});
		const pre = corsHelp.createEl('pre');
		const corsCode = pre.createEl('code');
		corsCode.setText([
			'{',
			'    "apiKey": null,',
			'    "apiPort": 8765,',
			'    "webCorsOriginList": [',
			'        "http://localhost",',
			'        "app://obsidian.md"',
			'    ]',
			'}',
		].join('\n'));

		corsHelp.createEl('p', {
			text: 'Remember to restart Anki desktop after saving configuration changes. Also verify http://127.0.0.1:8765 displays "AnkiConnect" when opened in your browser.',
		});

		new Setting(containerEl)
			.setName('AnkiConnect URL')
			.setDesc('The local address where AnkiConnect listens. If Anki is running on this computer with default settings, leave this as http://127.0.0.1:8765.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.ankiConnectUrl)
					.onChange(async (value) => {
						this.plugin.settings.ankiConnectUrl = value.trim() || 'http://127.0.0.1:8765';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('AnkiConnect API key')
			.setDesc('Optional security key. Leave blank unless you explicitly set an apiKey in your AnkiConnect configuration.')
			.addText((text) =>
				text
					.setPlaceholder('None (leave blank if not using an API key)')
					.setValue(this.plugin.settings.ankiConnectApiKey)
					.onChange(async (value) => {
						this.plugin.settings.ankiConnectApiKey = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		const testConnSetting = new Setting(containerEl)
			.setName('Test AnkiConnect connection')
			.setDesc('Verify that Anki desktop is running and reachable from Obsidian.');

		let statusEl: HTMLElement | null = null;
		testConnSetting.addButton((button) =>
			button.setButtonText('Test connection').onClick(async () => {
				button.setDisabled(true);
				button.setButtonText('Testing…');

				if (statusEl) {
					statusEl.remove();
					statusEl = null;
				}

				statusEl = testConnSetting.settingEl.createDiv({
					cls: 'anki-ast-connection-status anki-ast-connection-status--testing',
					text: 'Checking connection…',
				});

				const result = await this.plugin.checkAnkiConnect(false);
				button.setDisabled(false);
				button.setButtonText('Test connection');

				if (result.ok) {
					statusEl.className = 'anki-ast-connection-status anki-ast-connection-status--ok';
					statusEl.setText(`✓ Connected to AnkiConnect (API version ${result.version})`);
				} else {
					statusEl.className = 'anki-ast-connection-status anki-ast-connection-status--error';
					statusEl.setText(`✕ Connection failed: ${result.error ?? 'Unknown error'}`);
				}
			}),
		);

		// ----------------------------------------------------------------------
		// 2. Vault and Sync Scope
		// ----------------------------------------------------------------------
		new Setting(containerEl).setName('Vault and sync scope').setHeading();

		new Setting(containerEl)
			.setName('Scan folders')
			.setDesc('Comma-separated list of vault folders to search for notes with sync enabled (for example, notes or flashcards). Leave empty to scan your entire vault.')
			.addText((text) =>
				text
					.setPlaceholder('Notes, 01 - computer science')
					.setValue(this.plugin.settings.scanFolders)
					.onChange(async (value) => {
						this.plugin.settings.scanFolders = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Default Anki deck')
			.setDesc('The target deck where flashcards are placed if a note does not specify a deck in frontmatter. Will be created automatically if missing.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.defaultAnkiDeck)
					.onChange(async (value) => {
						this.plugin.settings.defaultAnkiDeck = value.trim() || 'Synced from Obsidian';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Auto-create missing decks')
			.setDesc('Automatically creates target decks in Anki during sync if they do not exist yet.')
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
			.setDesc('Ensures standard note types (Basic, Cloze, Reversible, Typed) are present in Anki so built-in cards always sync without manual setup.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCreateStockNoteModels)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateStockNoteModels = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Default engine tag')
			.setDesc('Tag attached to every card synced by this plugin (default Obsidian-Anki-AST). Identifies cards managed by this vault for safe updates and cleanups.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.defaultEngineTag)
					.onChange(async (value) => {
						this.plugin.settings.defaultEngineTag = value.trim() || 'Obsidian-Anki-AST';
						await this.plugin.saveSettings();
					}),
			);

		// ----------------------------------------------------------------------
		// 3. Card Syntax and Parsing
		// ----------------------------------------------------------------------
		new Setting(containerEl).setName('Card syntax and parsing').setHeading();

		new Setting(containerEl)
			.setName('Default card heading level')
			.setDesc('Heading level from 1 to 6 that defines where a flashcard begins (level 4 targets #### headings). The card envelope runs until the next heading.')
			.addSlider((slider) =>
				slider
					.setLimits(1, 6, 1)
					.setValue(this.plugin.settings.defaultCardDeclarationHeadingLevel)
					.onChange(async (value) => {
						this.plugin.settings.defaultCardDeclarationHeadingLevel = value;
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Card delimiter')
			.setDesc('Separator between front (question) and back (answer) of a card. Default is :::. Use :::r for reversible cards or :::t for typed answer cards.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.delimiter)
					.onChange(async (value) => {
						this.plugin.settings.delimiter = value.trim() || ':::';
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Infer cloze on basic cards')
			.setDesc('When enabled, basic cards that contain cloze syntax like {{c1::answer}} automatically sync as Cloze cards in Anki without requiring manual tags.')
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
			.setName('Include parent headers as tags')
			.setDesc('Automatically converts the headings above your card into nested tags in Anki, combined into hierarchical tag paths.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeParentHeadersAsTags)
					.onChange(async (value) => {
						this.plugin.settings.includeParentHeadersAsTags = value;
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Wikilink format')
			.setDesc('How note links and block transclusions (such as block embeds) are resolved across notes during card compilation.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('shortest', 'Shortest')
					.addOption('relative', 'Relative')
					.addOption('absolute', 'Absolute')
					.setValue(this.plugin.settings.linkFormat)
					.onChange(async (value) => {
						this.plugin.settings.linkFormat = value as AnkiAstSyncSettings['linkFormat'];
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Attachment folder')
			.setDesc('Vault folder for media attachments (images, audio, PDFs). Leave empty to use your Obsidian default attachment location.')
			.addText((text) =>
				text
					.setPlaceholder('Attachments')
					.setValue(this.plugin.settings.attachmentFolder)
					.onChange(async (value) => {
						this.plugin.settings.attachmentFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		// ----------------------------------------------------------------------
		// 4. Live Editor Preview
		// ----------------------------------------------------------------------
		new Setting(containerEl).setName('Live editor preview').setHeading();

		new Setting(containerEl)
			.setName('Live card preview')
			.setDesc('Highlights flashcard boundaries with subtle tinting and renders interactive status badges (sync, warn, skip, error) next to card headings.')
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
			.setName('Card heading line style')
			.setDesc('Visual styling for the card declaration heading line in live preview to distinguish card starts.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('off', 'Off (uniform with card body)')
					.addOption('shaded', 'Shaded header')
					.addOption('divided', 'Shaded header with divider')
					.setValue(this.plugin.settings.cardPreviewHeadingStyle ?? 'off')
					.onChange(async (value) => {
						this.plugin.settings.cardPreviewHeadingStyle =
							value as AnkiAstSyncSettings['cardPreviewHeadingStyle'];
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Section top background extend')
			.setDesc('Fraction of line height (0 to 1) to extend card background tint upward when following a higher-level section heading.')
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.05)
					.setValue(this.plugin.settings.cardPreviewSectionTopExtend)
					.onChange(async (value) => {
						this.plugin.settings.cardPreviewSectionTopExtend = value;
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Gap between card blocks')
			.setDesc('Untinted vertical space (in em) between consecutive cards in live preview.')
			.addSlider((slider) =>
				slider
					.setLimits(0, 0.8, 0.05)
					.setValue(this.plugin.settings.cardPreviewInterCardGapEm)
					.onChange(async (value) => {
						this.plugin.settings.cardPreviewInterCardGapEm = value;
						await this.plugin.saveSettings();
						this.plugin.cardPreview?.onSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Refresh note types cache')
			.setDesc('Fetches your latest Anki note types and custom field names from Anki desktop. Click this whenever you create or modify a custom card type in Anki.')
			.addButton((button) =>
				button.setButtonText('Refresh cache').onClick(async () => {
					await this.plugin.refreshNoteTypeMap();
				}),
			);

		// ----------------------------------------------------------------------
		// 5. Note Creation and Authoring Helpers
		// ----------------------------------------------------------------------
		new Setting(containerEl).setName('Note creation and authoring helpers').setHeading();

		new Setting(containerEl)
			.setName('New note folder')
			.setDesc('Folder where the "create new Anki note" command places files. Leave empty to use your default new note location.')
			.addText((text) =>
				text
					.setPlaceholder('Cards or notes/Anki')
					.setValue(this.plugin.settings.newNoteFolder)
					.onChange(async (value) => {
						this.plugin.settings.newNoteFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('New note default deck')
			.setDesc('Specific target deck pre-filled for newly created notes. Leave empty to inherit the default Anki deck above.')
			.addText((text) =>
				text
					.setPlaceholder('Inherit default deck')
					.setValue(this.plugin.settings.newNoteDefaultDeck)
					.onChange(async (value) => {
						this.plugin.settings.newNoteDefaultDeck = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Insert starter card in new notes')
			.setDesc('Automatically populates a starter card template when creating a new note with the helper command.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.newNoteInsertStarterCard)
					.onChange(async (value) => {
						this.plugin.settings.newNoteInsertStarterCard = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Auto-increment cloze index')
			.setDesc('When using "wrap selection as cloze deletion", automatically increments the index (c1, c2, c3...) within the current card.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.clozeAutoIncrement)
					.onChange(async (value) => {
						this.plugin.settings.clozeAutoIncrement = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Use shorthand cloze format')
			.setDesc('Generates shorthand {{...}} cloze syntax instead of explicit {{c1::...}} clozes when wrapping selections.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.clozeDefaultToShorthand)
					.onChange(async (value) => {
						this.plugin.settings.clozeDefaultToShorthand = value;
						await this.plugin.saveSettings();
					}),
			);

		// ----------------------------------------------------------------------
		// 6. Orphan Notes and Safety
		// ----------------------------------------------------------------------
		new Setting(containerEl).setName('Orphan notes and safety').setHeading();

		new Setting(containerEl)
			.setName('Orphan note handling')
			.setDesc('What to do when cards you previously synced to Anki are deleted or renamed in Obsidian. The ask each sync option shows a confirmation dialog; off skips the check.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('ask', 'Ask each sync')
					.addOption('off', 'Off (skip orphan check for faster sync)')
					.setValue(this.plugin.settings.orphanHandling)
					.onChange(async (value) => {
						this.plugin.settings.orphanHandling = value as AnkiAstSyncSettings['orphanHandling'];
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Allow suspend for orphan notes')
			.setDesc('Enables a "suspend" action in the orphan resolution dialog, letting you pause reviews in Anki without deleting card statistics.')
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
			.setDesc('Tag added to Anki notes when you choose "ignore" on orphans so they are skipped in future syncs.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.orphanIgnoreTag)
					.onChange(async (value) => {
						this.plugin.settings.orphanIgnoreTag = value.trim() || 'obsidian-sync-ignore';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Obsidian ID tag prefix')
			.setDesc('Tag prefix in Anki that links cards to notes in your vault so edits update the same card.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.syncTagPrefix)
					.onChange(async (value) => {
						this.plugin.settings.syncTagPrefix = value.trim() || 'obsidian-id';
						await this.plugin.saveSettings();
					}),
			);

		// ----------------------------------------------------------------------
		// 7. Interactive Syntax and Workflow Guide
		// ----------------------------------------------------------------------
		new Setting(containerEl).setName('Card syntax and workflow guide').setHeading();

		const guideContainer = containerEl.createDiv({ cls: 'anki-ast-guide-container' });
		const guideDetails = guideContainer.createEl('details');
		guideDetails.createEl('summary', { text: 'Quick start, card syntax, and command reference' });

		const guideContent = guideDetails.createDiv({ cls: 'anki-ast-guide-content' });

		const renderGuideCode = (parent: HTMLElement, lines: string[]) => {
			const preBlock = parent.createEl('pre');
			const codeBlock = preBlock.createEl('code');
			codeBlock.setText(lines.join('\n'));
		};

		guideContent.createDiv({
			cls: 'setting-item-heading anki-ast-guide-heading',
			text: '1. Enabling sync on a note',
		});
		guideContent.createEl('p', {
			text: 'Add the AnkiSync property to your note frontmatter to mark it for sync. You can also specify an optional target deck and tags:',
		});
		renderGuideCode(guideContent, [
			'---',
			'AnkiSync: on',
			'target_anki_deck: Computer Science',
			'file_anki_tags: algorithms, revision',
			'---',
		]);

		guideContent.createDiv({
			cls: 'setting-item-heading anki-ast-guide-heading',
			text: '2. Card types and syntax',
		});

		guideContent.createEl('p', { text: 'Basic card with body question and answer:' });
		renderGuideCode(guideContent, [
			'#### Binary Search',
			'What is the time complexity of binary search?',
			':::',
			'O(log n) because the search space halves on every step.',
		]);

		guideContent.createEl('p', { text: 'Basic card using heading as front:' });
		renderGuideCode(guideContent, [
			'#### What is the speed of light in vacuum?',
			':::',
			'Approximately 3 × 10⁸ m/s.',
		]);

		guideContent.createEl('p', { text: 'Reversible card generating forward and reverse cards:' });
		renderGuideCode(guideContent, [
			'#### French Vocabulary',
			'Bonjour',
			':::r',
			'Hello',
		]);

		guideContent.createEl('p', { text: 'Typed answer card testing spelling with optional pipes:' });
		renderGuideCode(guideContent, [
			'#### Linux Commands',
			'What command lists directory contents in Linux?',
			':::t',
			'ls | dir',
		]);

		guideContent.createEl('p', { text: 'Cloze card with front deletions and optional back extra:' });
		renderGuideCode(guideContent, [
			'#### Photosynthesis #anki/cardType/cloze',
			'In plants, {{c1::chlorophyll}} absorbs light to convert {{c2::carbon dioxide}} and water into glucose.',
			':::',
			'Optional back extra: Takes place in chloroplast organelles.',
		]);

		guideContent.createEl('p', { text: 'Custom Anki note type matching model fields:' });
		renderGuideCode(guideContent, [
			'#### Ephemeral #anki/noteType/Vocab',
			'::: Word',
			'ephemeral',
			'::: Definition',
			'Lasting for a very short time; transitory.',
			'::: Example',
			'Fashions are ephemeral, but style endures.',
		]);

		guideContent.createDiv({
			cls: 'setting-item-heading anki-ast-guide-heading',
			text: '3. Frontmatter configuration reference',
		});
		const table = guideContent.createEl('table', { cls: 'anki-ast-guide-table' });
		const thead = table.createEl('thead');
		const headRow = thead.createEl('tr');
		headRow.createEl('th', { text: 'Property' });
		headRow.createEl('th', { text: 'Values' });
		headRow.createEl('th', { text: 'Description' });

		const tbody = table.createEl('tbody');
		const addRow = (prop: string, values: string, desc: string) => {
			const tr = tbody.createEl('tr');
			const tdCode = tr.createEl('td').createEl('code');
			tdCode.textContent = prop;
			tr.createEl('td', { text: values });
			tr.createEl('td', { text: desc });
		};

		addRow('AnkiSync', 'on | off | true | false', 'Enables or disables synchronization for this note.');
		addRow('target_anki_deck', 'Deck Name', 'Overrides the default target Anki deck for all cards in this note.');
		addRow('file_anki_tags', 'tag1, tag2', 'Comma-separated tags added to every card in this note.');
		addRow('cardDeclarationHeadingLevel', '1 to 6', 'Overrides the card heading level for this note (default 4 for ####).');
		addRow('delimiter', 'String (e.g. :::)', 'Overrides the card front/back delimiter for this note.');
		addRow('includeParentHeadersAsTags', 'true | false', 'Toggles hierarchical tags from ancestor headings.');
		addRow('anki_cardDefault', 'basic | cloze | reversible | typed', 'Default built-in card type for cards without explicit delimiters.');
		addRow('anki_customCardDefault', 'Custom Note Type', 'Default custom note type (e.g. Vocab) when using ::: FieldName blocks.');

		guideContent.createDiv({
			cls: 'setting-item-heading anki-ast-guide-heading',
			text: '4. Live preview outcome badges',
		});
		guideContent.createEl('p', {
			text: 'When live preview is enabled, card headings display interactive status badges indicating their sync readiness:',
		});
		const badgeList = guideContent.createEl('ul');
		badgeList.createEl('li', {
			text: 'Sync (green): Card syntax is valid and ready to sync.',
		});
		badgeList.createEl('li', {
			text: 'Warn (amber): Card will sync, but has potential formatting concerns (such as cloze with no answer side).',
		});
		badgeList.createEl('li', {
			text: 'Skip (gray): Card will be skipped (such as duplicate front collision or excluded card).',
		});
		badgeList.createEl('li', {
			text: 'Error (red): Structural error. Sync writes to Anki are hard-blocked to protect your Anki collection. Click the badge to open the card diagnostic modal.',
		});

		guideContent.createDiv({
			cls: 'setting-item-heading anki-ast-guide-heading',
			text: '5. Key commands',
		});
		guideContent.createEl('p', {
			text: 'Open the Command Palette (Ctrl/Cmd + P) to access quick actions:',
		});
		const cmdList = guideContent.createEl('ul');
		cmdList.createEl('li', { text: 'Anki AST sync: Sync current note to Anki — fast single-file sync.' });
		cmdList.createEl('li', { text: 'Anki AST sync: Sync vault to Anki — full vault scan and synchronization.' });
		cmdList.createEl('li', { text: 'Anki AST sync: Dry-run sync current note / vault to Anki — preview actions without writing.' });
		cmdList.createEl('li', { text: 'Anki AST sync: Check AnkiConnect connection — quick ping test.' });
		cmdList.createEl('li', { text: 'Anki AST sync: Insert card template... — prompt to insert Basic, Cloze, Reversible, or Typed cards.' });
		cmdList.createEl('li', { text: 'Anki AST sync: Wrap selection as cloze deletion — wraps highlighted text as {{c1::...}} with auto-increment.' });
		cmdList.createEl('li', { text: 'Anki AST sync: Jump to next / previous card in note — navigate between flashcards quickly.' });
		cmdList.createEl('li', { text: 'Anki AST sync: Jump to next card with sync issue — jump directly to warnings or errors.' });
		cmdList.createEl('li', { text: 'Anki AST sync: Open current card in Anki desktop — browse the active card in Anki desktop.' });
	}
}
