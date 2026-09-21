import type { App } from 'obsidian';
import type { Config } from 'obsidian-anki-ast-engine/config';
import type { AnkiAstSyncSettings } from './settings';
import { parseScanFolders } from './scanFolders';

export function buildPluginConfig(
	app: App,
	settings: AnkiAstSyncSettings,
): Config {
	const adapter = app.vault.adapter as { getBasePath?: () => string } | undefined;
	const vaultPath =
		typeof adapter?.getBasePath === 'function'
			? adapter.getBasePath()
			: '';

	return {
		vaultPath,
		delimiter: settings.delimiter || ':::',
		scanFolders: parseScanFolders(settings.scanFolders),
		defaultAnkiDeck: settings.defaultAnkiDeck || 'Synced from Obsidian',
		defaultEngineTag: settings.defaultEngineTag || 'Obsidian-Anki-AST',
		ankiConnectUrl: settings.ankiConnectUrl || 'http://127.0.0.1:8765',
		ankiConnectApiKey: settings.ankiConnectApiKey || undefined,
		noteModelName: settings.noteModelName || 'Basic',
		noteModelType: 'basic',
		autoCreateDecks: settings.autoCreateDecks ?? true,
		autoCreateStockNoteModels: settings.autoCreateStockNoteModels ?? true,
		inferClozeFromManualSyntaxOnBasic:
			settings.inferClozeFromManualSyntaxOnBasic ?? false,
		syncTagPrefix: settings.syncTagPrefix || 'obsidian-id',
		orphanIgnoreTag: settings.orphanIgnoreTag || 'obsidian-sync-ignore',
		linkFormat: settings.linkFormat || 'shortest',
		attachmentFolder: settings.attachmentFolder || undefined,
		defaultCardDeclarationHeadingLevel:
			settings.defaultCardDeclarationHeadingLevel ?? 4,
		includeParentHeadersAsTags: settings.includeParentHeadersAsTags ?? true,
	};
}
