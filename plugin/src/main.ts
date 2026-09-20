import { Notice, Plugin, addIcon } from 'obsidian';
import { ANKI_SYNC_STAR_ICON_ID, registerPluginIcons } from './icons';
import type { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import { createObsidianFetch } from './obsidianFetch';
import {
	AnkiAstSyncSettingTab,
	DEFAULT_SETTINGS,
	type AnkiAstSyncSettings,
} from './settings';
import type { CardPreviewManager } from './cardPreview';

type SyncOrchestratorModule = typeof import('./syncOrchestrator');

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
			id: 'remove-anki-sync-comments-current-note',
			name: 'Remove all Anki sync comments from current Obsidian note',
			callback: () => {
				void import('./commentCleaner').then((m) =>
					m.removeAnkiSyncCommentsFromActiveNote(this.app),
				);
			},
		});

		this.addCommand({
			id: 'create-new-anki-note',
			name: 'Create new Anki note',
			callback: () => {
				void import('./helpers/noteHelpers').then((m) =>
					m.createNewAnkiNote(this.app, this.settings),
				);
			},
		});

		this.addCommand({
			id: 'toggle-anki-sync-current-note',
			name: 'Toggle Anki sync for current note',
			callback: () => {
				void import('./helpers/noteHelpers').then((m) =>
					m.toggleAnkiSyncForActiveNote(this.app),
				);
			},
		});

		this.addCommand({
			id: 'set-target-deck-current-note',
			name: 'Set target Anki deck for current note',
			callback: () => {
				void import('./helpers/noteHelpers').then((m) =>
					m.setTargetDeckForActiveNote(this.app, () => this.createAnkiClient()),
				);
			},
		});

		this.addCommand({
			id: 'insert-card-template-picker',
			name: 'Insert card template...',
			editorCheckCallback: (checking, editor) => {
				if (checking) return !!editor;
				void import('./helpers/cardTemplates').then((m) =>
					m.openCardTemplatePicker(
						this.app,
						editor,
						this.settings,
						this.cardPreview?.getNoteTypeFieldMap(),
					),
				);
				return true;
			},
		});

		this.addCommand({
			id: 'insert-card-basic',
			name: 'Insert basic card at cursor',
			editorCheckCallback: (checking, editor) => {
				if (checking) return !!editor;
				void import('./helpers/cardTemplates').then((m) =>
					m.insertCardTemplate(this.app, editor, this.settings, 'basic'),
				);
				return true;
			},
		});

		this.addCommand({
			id: 'insert-card-reversible',
			name: 'Insert reversible card at cursor',
			editorCheckCallback: (checking, editor) => {
				if (checking) return !!editor;
				void import('./helpers/cardTemplates').then((m) =>
					m.insertCardTemplate(this.app, editor, this.settings, 'reversible'),
				);
				return true;
			},
		});

		this.addCommand({
			id: 'insert-card-typed',
			name: 'Insert typed card at cursor',
			editorCheckCallback: (checking, editor) => {
				if (checking) return !!editor;
				void import('./helpers/cardTemplates').then((m) =>
					m.insertCardTemplate(this.app, editor, this.settings, 'typed'),
				);
				return true;
			},
		});

		this.addCommand({
			id: 'insert-card-cloze',
			name: 'Insert cloze card at cursor',
			editorCheckCallback: (checking, editor) => {
				if (checking) return !!editor;
				void import('./helpers/cardTemplates').then((m) =>
					m.insertCardTemplate(this.app, editor, this.settings, 'cloze'),
				);
				return true;
			},
		});

		this.addCommand({
			id: 'wrap-selection-cloze',
			name: 'Wrap selection as cloze deletion',
			editorCheckCallback: (checking, editor) => {
				if (checking) return !!editor;
				void import('./helpers/cardTemplates').then((m) =>
					m.wrapSelectionWithCloze(this.app, editor, this.settings),
				);
				return true;
			},
		});

		this.addCommand({
			id: 'jump-to-next-card',
			name: 'Jump to next card in note',
			editorCheckCallback: (checking, editor) => {
				if (checking) return !!editor;
				void import('./navigation/cardNavigation').then((m) =>
					m.jumpToNextCard(this.app, editor, this.settings),
				);
				return true;
			},
		});

		this.addCommand({
			id: 'jump-to-previous-card',
			name: 'Jump to previous card in note',
			editorCheckCallback: (checking, editor) => {
				if (checking) return !!editor;
				void import('./navigation/cardNavigation').then((m) =>
					m.jumpToPreviousCard(this.app, editor, this.settings),
				);
				return true;
			},
		});

		this.addCommand({
			id: 'jump-to-next-problem-card',
			name: 'Jump to next card with sync issue (warning/error)',
			editorCheckCallback: (checking, editor) => {
				if (checking) return !!editor;
				void import('./navigation/cardNavigation').then((m) =>
					m.jumpToNextProblemCard(this.app, editor, this.settings),
				);
				return true;
			},
		});

		this.addCommand({
			id: 'open-card-in-anki',
			name: 'Open current card in Anki Desktop',
			editorCheckCallback: (checking, editor) => {
				if (checking) return !!editor;
				void import('./navigation/cardNavigation').then((m) =>
					m.openActiveCardInAnki(this.app, editor, this.settings, () =>
						this.createAnkiClient(),
					),
				);
				return true;
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

		this.app.workspace.onLayoutReady(() => {
			void this.syncCardPreviewRegistration();
		});
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

	async syncCardPreviewRegistration(): Promise<void> {
		if (this.settings.enableCardPreview) {
			if (!this.cardPreview) {
				const { registerCardPreview } = await import('./cardPreview');
				this.cardPreview = registerCardPreview(
					this,
					() => this.settings,
					() => this.fetchNoteTypeFieldMap(),
				);
			}
			return;
		}

		this.cardPreview?.destroy();
		this.cardPreview = undefined;
	}

	private async createAnkiClient(): Promise<AnkiConnectClient> {
		const { AnkiConnectClient } = await import('obsidian-anki-ast-engine/anki');
		return new AnkiConnectClient({
			url: this.settings.ankiConnectUrl,
			apiKey: this.settings.ankiConnectApiKey || undefined,
			fetchImpl: this.ankiFetch,
		});
	}

	private async checkAnkiConnect(): Promise<void> {
		const client = await this.createAnkiClient();

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
		return Promise.all([this.getSyncOrchestrator(), this.createAnkiClient()]).then(
			([module, client]) =>
				module.runSyncFlow(this.app, this.settings, () => client, {
					dryRun: false,
					noteTypeFieldNamesByNoteType: this.cardPreview?.getNoteTypeFieldMap(),
				}),
		);
	}

	private dryRunSyncVaultToAnki(): Promise<void> {
		return Promise.all([this.getSyncOrchestrator(), this.createAnkiClient()]).then(
			([module, client]) =>
				module.runSyncFlow(this.app, this.settings, () => client, {
					dryRun: true,
					noteTypeFieldNamesByNoteType: this.cardPreview?.getNoteTypeFieldMap(),
				}),
		);
	}

	private dryRunSyncCurrentFile(): Promise<void> {
		return Promise.all([this.getSyncOrchestrator(), this.createAnkiClient()]).then(
			([module, client]) =>
				module.runSyncFlowForActiveFile(
					this.app,
					this.settings,
					() => client,
					{
						dryRun: true,
						noteTypeFieldNamesByNoteType: this.cardPreview?.getNoteTypeFieldMap(),
					},
				),
		);
	}

	private syncCurrentFileToAnki(): Promise<void> {
		return Promise.all([this.getSyncOrchestrator(), this.createAnkiClient()]).then(
			([module, client]) =>
				module.runSyncFlowForActiveFile(
					this.app,
					this.settings,
					() => client,
					{
						dryRun: false,
						noteTypeFieldNamesByNoteType: this.cardPreview?.getNoteTypeFieldMap(),
					},
				),
		);
	}

	private async reloadCss(): Promise<void> {
		const { reloadPluginCss } = await import('./devReload');
		const result = await reloadPluginCss(this);
		new Notice(result.message, result.ok ? undefined : 12_000);
	}

	private async reloadSelf(): Promise<void> {
		const { reloadPlugin } = await import('./devReload');
		const result = await reloadPlugin(this);
		new Notice(result.message, result.ok ? undefined : 12_000);
	}

	async refreshNoteTypeMap(): Promise<void> {
		const { formatNoteTypeCacheNotice } = await import('./cardPreviewUtils');
		const result =
			(await this.cardPreview?.refreshNoteTypeMap()) ?? {
				ok: false,
				error: 'Card preview is not available.',
			};
		const message = formatNoteTypeCacheNotice(result);
		new Notice(message, result.ok ? undefined : 12_000);
	}

	private async getSyncOrchestrator(): Promise<SyncOrchestratorModule> {
		return import('./syncOrchestrator');
	}

	private async fetchNoteTypeFieldMap(): Promise<Record<string, string[]>> {
		const client = await this.createAnkiClient();
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
