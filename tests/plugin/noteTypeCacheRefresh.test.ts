import { describe, expect, test } from 'bun:test';
import {
	buildNoteTypeCacheRefreshResult,
	formatNoteTypeCacheNotice,
	performNoteTypeCacheRefresh,
	refreshNoteTypeMapFromHook,
	type NoteTypeCacheRefreshResult,
} from '../../plugin/src/cardPreviewUtils';

describe('formatNoteTypeCacheNotice', () => {
	test('formats success with count and all names when list is short', () => {
		const result: NoteTypeCacheRefreshResult = {
			ok: true,
			noteTypeNames: ['Basic', 'Cloze', 'Vocab'],
			noteTypeFieldMap: {
				Basic: ['Front', 'Back'],
				Cloze: ['Text'],
				Vocab: ['Word', 'Definition'],
			},
		};
		expect(formatNoteTypeCacheNotice(result)).toBe(
			'Refreshed 3 note types: Basic, Cloze, Vocab',
		);
	});

	test('uses singular label for one note type', () => {
		const result: NoteTypeCacheRefreshResult = {
			ok: true,
			noteTypeNames: ['Basic'],
			noteTypeFieldMap: { Basic: ['Front', 'Back'] },
		};
		expect(formatNoteTypeCacheNotice(result)).toBe('Refreshed 1 note type: Basic');
	});

	test('truncates long name lists gracefully', () => {
		const names = Array.from({ length: 12 }, (_, index) => `Type${index + 1}`);
		const result: NoteTypeCacheRefreshResult = {
			ok: true,
			noteTypeNames: names,
			noteTypeFieldMap: Object.fromEntries(names.map((name) => [name, ['Field']])),
		};
		expect(formatNoteTypeCacheNotice(result, { maxNames: 8 })).toBe(
			'Refreshed 12 note types: Type1, Type2, Type3, Type4, Type5, Type6, Type7, Type8, and 4 more',
		);
	});

	test('formats failure with error prefix', () => {
		const result: NoteTypeCacheRefreshResult = {
			ok: false,
			error: 'AnkiConnect unavailable',
		};
		expect(formatNoteTypeCacheNotice(result)).toBe(
			'Failed to refresh note type cache: AnkiConnect unavailable',
		);
	});
});

describe('buildNoteTypeCacheRefreshResult', () => {
	test('returns success with note type names from map keys', () => {
		expect(
			buildNoteTypeCacheRefreshResult({
				Basic: ['Front', 'Back'],
				Cloze: ['Text'],
			}),
		).toEqual({
			ok: true,
			noteTypeNames: ['Basic', 'Cloze'],
			noteTypeFieldMap: {
				Basic: ['Front', 'Back'],
				Cloze: ['Text'],
			},
		});
	});

	test('treats empty map as failure', () => {
		expect(buildNoteTypeCacheRefreshResult({})).toEqual({
			ok: false,
			error: 'AnkiConnect returned no note types',
		});
	});
});

describe('performNoteTypeCacheRefresh', () => {
	test('returns success when fetch resolves with note types', async () => {
		const result = await performNoteTypeCacheRefresh(async () => ({
			Basic: ['Front', 'Back'],
			Vocab: ['Word', 'Definition'],
		}));
		expect(result).toEqual({
			ok: true,
			noteTypeNames: ['Basic', 'Vocab'],
			noteTypeFieldMap: {
				Basic: ['Front', 'Back'],
				Vocab: ['Word', 'Definition'],
			},
		});
	});

	test('returns failure when fetch throws', async () => {
		const result = await performNoteTypeCacheRefresh(async () => {
			throw new Error('fetch failed');
		});
		expect(result).toEqual({
			ok: false,
			error: 'fetch failed',
		});
	});

	test('returns failure when fetch resolves to empty map', async () => {
		const result = await performNoteTypeCacheRefresh(async () => ({}));
		expect(result).toEqual({
			ok: false,
			error: 'AnkiConnect returned no note types',
		});
	});
});

describe('refreshNoteTypeMapFromHook', () => {
	test('returns connector-unavailable failure when hook is missing', async () => {
		await expect(refreshNoteTypeMapFromHook(undefined)).resolves.toEqual({
			ok: false,
			error: 'Note type refresh unavailable (connector not configured).',
		});
	});

	test('returns success on hook success', async () => {
		await expect(
			refreshNoteTypeMapFromHook(async () => ({
				Basic: ['Front', 'Back'],
				Cloze: ['Text'],
			})),
		).resolves.toEqual({
			ok: true,
			noteTypeNames: ['Basic', 'Cloze'],
			noteTypeFieldMap: {
				Basic: ['Front', 'Back'],
				Cloze: ['Text'],
			},
		});
	});

	test('returns failure when hook throws (Anki off)', async () => {
		await expect(
			refreshNoteTypeMapFromHook(async () => {
				throw new Error('AnkiConnect unavailable');
			}),
		).resolves.toEqual({
			ok: false,
			error: 'AnkiConnect unavailable',
		});
	});
});
