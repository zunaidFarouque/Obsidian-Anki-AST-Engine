import type { App } from 'obsidian';
import { ConfigSchema, type Config } from 'obsidian-anki-ast-engine/config';
import type { AnkiAstSyncSettings } from './settings';
import { parseScanFolders } from './scanFolders';

export function buildPluginConfig(
	app: App,
	settings: AnkiAstSyncSettings,
): Config {
	const adapter = app.vault.adapter;
	const vaultPath =
		'getBasePath' in adapter && typeof adapter.getBasePath === 'function'
			? adapter.getBasePath()
			: '';

	return ConfigSchema.parse({
		vaultPath,
		delimiter: settings.delimiter,
		scanFolders: parseScanFolders(settings.scanFolders),
		defaultAnkiDeck: settings.defaultAnkiDeck,
		defaultEngineTag: settings.defaultEngineTag,
		ankiConnectUrl: settings.ankiConnectUrl,
		ankiConnectApiKey: settings.ankiConnectApiKey || undefined,
		noteModelName: settings.noteModelName,
		noteModelType: 'basic',
		autoCreateDecks: settings.autoCreateDecks,
		syncTagPrefix: settings.syncTagPrefix,
		linkFormat: settings.linkFormat,
		attachmentFolder: settings.attachmentFolder || undefined,
		defaultCardDeclarationHeadingLevel:
			settings.defaultCardDeclarationHeadingLevel,
		includeParentHeadersAsTags: settings.includeParentHeadersAsTags,
	});
}
