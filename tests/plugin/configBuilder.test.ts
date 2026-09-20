import { describe, expect, test } from 'bun:test';
import { parseScanFolders } from '../../plugin/src/scanFolders';
import { buildPluginConfig } from '../../plugin/src/configBuilder';
import type { AnkiAstSyncSettings } from '../../plugin/src/settings';
import type { App } from 'obsidian';

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
	autoCreateStockNoteModels: true,
	noteModelName: 'Basic',
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
			noteModelName: 'Basic (and reversed card)',
			syncTagPrefix: 'vault-card-id',
		};

		const mockApp = {
			vault: {
				adapter: {
					getBasePath: () => 'C:/Vault',
				},
			},
		} as unknown as App;

		const config = buildPluginConfig(mockApp, settings);

		expect(config.vaultPath).toBe('C:/Vault');
		expect(config.scanFolders).toEqual(['Notes']);
		expect(config.ankiConnectApiKey).toBe('secret');
		expect(config.noteModelName).toBe('Basic (and reversed card)');
		expect(config.syncTagPrefix).toBe('vault-card-id');
	});
});
