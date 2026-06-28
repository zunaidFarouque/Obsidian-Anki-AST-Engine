import { describe, expect, test } from 'bun:test';
import { parseScanFolders } from '../../plugin/src/scanFolders';
import { ConfigSchema } from '../../src/config/configParser';
import type { AnkiAstSyncSettings } from '../../plugin/src/settings';

const baseSettings: AnkiAstSyncSettings = {
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

describe('configBuilder', () => {
	test('parseScanFolders returns ["."] when empty', () => {
		expect(parseScanFolders('')).toEqual(['.']);
		expect(parseScanFolders('  ,  ')).toEqual(['.']);
	});

	test('parseScanFolders splits comma-separated folders', () => {
		expect(parseScanFolders('Notes, 01 - CS')).toEqual([
			'Notes',
			'01 - CS',
		]);
	});

	test('buildPluginConfig maps settings and vault path', () => {
		const settings: AnkiAstSyncSettings = {
			...baseSettings,
			scanFolders: 'Notes',
			ankiConnectApiKey: 'secret',
		};

		const config = ConfigSchema.parse({
			vaultPath: 'C:/Vault',
			delimiter: settings.delimiter,
			scanFolders: parseScanFolders(settings.scanFolders),
			defaultAnkiDeck: settings.defaultAnkiDeck,
			defaultEngineTag: settings.defaultEngineTag,
			ankiConnectUrl: settings.ankiConnectUrl,
			ankiConnectApiKey: settings.ankiConnectApiKey || undefined,
			noteModelName: 'Basic',
			noteModelType: 'basic',
			autoCreateDecks: settings.autoCreateDecks,
			syncTagPrefix: 'obsidian-id',
			linkFormat: settings.linkFormat,
			attachmentFolder: settings.attachmentFolder || undefined,
			defaultCardDeclarationHeadingLevel:
				settings.defaultCardDeclarationHeadingLevel,
			includeParentHeadersAsTags: settings.includeParentHeadersAsTags,
		});

		expect(config.vaultPath).toBe('C:/Vault');
		expect(config.scanFolders).toEqual(['Notes']);
		expect(config.ankiConnectApiKey).toBe('secret');
		expect(config.noteModelName).toBe('Basic');
		expect(config.syncTagPrefix).toBe('obsidian-id');
	});
});
