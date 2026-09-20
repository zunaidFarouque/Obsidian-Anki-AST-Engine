import { describe, expect, test } from 'bun:test';
import {
	buildNewNoteContent,
	getFrontmatterSyncState,
	setTargetDeckFrontmatter,
	toggleAnkiSyncFrontmatter,
} from '../../plugin/src/helpers/noteHelperUtils';

describe('noteHelperUtils', () => {
	describe('buildNewNoteContent', () => {
		test('generates minimal frontmatter with default starter basic card', () => {
			const result = buildNewNoteContent({
				deck: 'Default Deck',
				starterCard: true,
				headingLevel: 4,
			});

			expect(result.content).toContain('---\nAnkiSync: on\ntarget_anki_deck: "Default Deck"\n---');
			expect(result.content).toContain('#### Card Title\nFront text\n:::\nBack text\n');
			// Cursor should be placed at "Card Title" or right after #### 
			expect(result.cursorOffset).toBeGreaterThan(0);
			const textAtCursor = result.content.slice(result.cursorOffset);
			expect(textAtCursor.startsWith('Card Title') || textAtCursor.startsWith('#### Card Title')).toBe(true);
		});

		test('generates note without starter card when starterCard is false', () => {
			const result = buildNewNoteContent({
				deck: 'Biology',
				starterCard: false,
			});

			expect(result.content).toBe('---\nAnkiSync: on\ntarget_anki_deck: "Biology"\n---\n\n');
			expect(result.cursorOffset).toBe(result.content.length);
		});

		test('omits target_anki_deck if deck is empty or undefined', () => {
			const result = buildNewNoteContent({
				starterCard: false,
			});

			expect(result.content).toBe('---\nAnkiSync: on\n---\n\n');
			expect(result.cursorOffset).toBe(result.content.length);
		});

		test('respects custom heading level and delimiter for starter card', () => {
			const result = buildNewNoteContent({
				starterCard: true,
				headingLevel: 3,
				delimiter: '?',
				cardType: 'basic',
			});

			expect(result.content).toContain('### Card Title\nFront text\n?\nBack text\n');
		});

		test('generates cloze starter card when requested', () => {
			const result = buildNewNoteContent({
				starterCard: true,
				cardType: 'cloze',
				headingLevel: 4,
			});

			expect(result.content).toContain('#### Cloze Card\nThe {{c1::cloze deletion}} goes here.\n:::\nBack extra\n');
		});

		test('generates reversible starter card with :::r', () => {
			const result = buildNewNoteContent({
				starterCard: true,
				cardType: 'reversible',
				headingLevel: 4,
			});

			expect(result.content).toContain('#### Term\nFront\n:::r\nBack\n');
		});

		test('generates typed starter card with :::t', () => {
			const result = buildNewNoteContent({
				starterCard: true,
				cardType: 'typed',
				headingLevel: 4,
			});

			expect(result.content).toContain('#### Prompt\nQuestion\n:::t\nAnswer\n');
		});
	});

	describe('getFrontmatterSyncState', () => {
		test('returns "missing" when frontmatter is null, undefined, or lacks AnkiSync', () => {
			expect(getFrontmatterSyncState(null)).toBe('missing');
			expect(getFrontmatterSyncState(undefined)).toBe('missing');
			expect(getFrontmatterSyncState({})).toBe('missing');
			expect(getFrontmatterSyncState({ title: 'Note' })).toBe('missing');
		});

		test('returns "on" for truthy AnkiSync values (case insensitive)', () => {
			expect(getFrontmatterSyncState({ AnkiSync: 'on' })).toBe('on');
			expect(getFrontmatterSyncState({ ankisync: 'ON' })).toBe('on');
			expect(getFrontmatterSyncState({ AnkiSync: true })).toBe('on');
			expect(getFrontmatterSyncState({ AnkiSync: 'yes' })).toBe('on');
			expect(getFrontmatterSyncState({ AnkiSync: 'true' })).toBe('on');
		});

		test('returns "off" for falsey AnkiSync values', () => {
			expect(getFrontmatterSyncState({ AnkiSync: 'off' })).toBe('off');
			expect(getFrontmatterSyncState({ ankisync: 'OFF' })).toBe('off');
			expect(getFrontmatterSyncState({ AnkiSync: false })).toBe('off');
			expect(getFrontmatterSyncState({ AnkiSync: 'no' })).toBe('off');
			expect(getFrontmatterSyncState({ AnkiSync: 'false' })).toBe('off');
		});
	});

	describe('toggleAnkiSyncFrontmatter', () => {
		test('sets AnkiSync to "on" when missing', () => {
			const fm: Record<string, unknown> = { title: 'Note' };
			const result = toggleAnkiSyncFrontmatter(fm);
			expect(result.newState).toBe('on');
			expect(result.updated.AnkiSync).toBe('on');
			expect(result.updated.title).toBe('Note');
		});

		test('toggles AnkiSync from "on" to "off"', () => {
			const fm: Record<string, unknown> = { AnkiSync: 'on', tags: ['flashcards'] };
			const result = toggleAnkiSyncFrontmatter(fm);
			expect(result.newState).toBe('off');
			expect(result.updated.AnkiSync).toBe('off');
			expect(result.updated.tags).toEqual(['flashcards']);
		});

		test('toggles AnkiSync from "off" to "on"', () => {
			const fm: Record<string, unknown> = { AnkiSync: 'off' };
			const result = toggleAnkiSyncFrontmatter(fm);
			expect(result.newState).toBe('on');
			expect(result.updated.AnkiSync).toBe('on');
		});

		test('handles case-insensitive key existing', () => {
			const fm: Record<string, unknown> = { ankisync: 'on' };
			const result = toggleAnkiSyncFrontmatter(fm);
			expect(result.newState).toBe('off');
			// Replaces the lowercase key with normalized AnkiSync or keeps matching key
			expect(result.updated.AnkiSync ?? result.updated.ankisync).toBe('off');
		});
	});

	describe('setTargetDeckFrontmatter', () => {
		test('sets target_anki_deck in frontmatter', () => {
			const fm: Record<string, unknown> = { AnkiSync: 'on' };
			const updated = setTargetDeckFrontmatter(fm, 'Computer Science::Algorithms');
			expect(updated.target_anki_deck).toBe('Computer Science::Algorithms');
			expect(updated.AnkiSync).toBe('on');
		});

		test('overwrites existing target_anki_deck regardless of case', () => {
			const fm: Record<string, unknown> = { TARGET_ANKI_DECK: 'Old Deck' };
			const updated = setTargetDeckFrontmatter(fm, 'New Deck');
			expect(updated.target_anki_deck).toBe('New Deck');
			expect(updated.TARGET_ANKI_DECK).toBeUndefined();
		});
	});
});
