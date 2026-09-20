import { describe, expect, test } from 'bun:test';
import {
	extractCardAnkiId,
	findCardHeadings,
	findEnclosingCardBounds,
	findNextCardLine,
	findNextProblemCardLine,
	findPreviousCardLine,
	findProblemCards,
} from '../../plugin/src/navigation/cardNavigationUtils';

describe('cardNavigationUtils (Phase 3)', () => {
	const sampleDoc = [
		'---',
		'AnkiSync: on',
		'---',
		'# Topic Overview',
		'',
		'#### First Card',
		'Question 1',
		':::',
		'Answer 1',
		'<!--anki-id: 1234567890-->',
		'',
		'#### Second Card',
		'Question 2',
		':::',
		'Answer 2',
		'<!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->',
		'',
		'#### Third Card',
		'Question 3',
		':::r',
		'Answer 3',
	];

	describe('findCardHeadings', () => {
		test('locates all H4 headings in document', () => {
			const headings = findCardHeadings(sampleDoc, 4);
			expect(headings.length).toBe(3);
			expect(headings[0]).toEqual({ line: 5, text: '#### First Card' });
			expect(headings[1]).toEqual({ line: 11, text: '#### Second Card' });
			expect(headings[2]).toEqual({ line: 17, text: '#### Third Card' });
		});

		test('ignores headings with deeper or shallower depth', () => {
			const headings = findCardHeadings(sampleDoc, 4);
			expect(headings.some((h) => h.text.includes('Topic Overview'))).toBe(false);
		});

		test('returns empty array when no matching headings exist', () => {
			expect(findCardHeadings(sampleDoc, 2)).toEqual([]);
		});
	});

	describe('findNextCardLine', () => {
		test('jumps to next card heading from current line', () => {
			expect(findNextCardLine(sampleDoc, 0, 4)).toBe(5);
			expect(findNextCardLine(sampleDoc, 5, 4)).toBe(11);
			expect(findNextCardLine(sampleDoc, 8, 4)).toBe(11);
			expect(findNextCardLine(sampleDoc, 11, 4)).toBe(17);
		});

		test('wraps around to first card when at the last card with wrapAround=true', () => {
			expect(findNextCardLine(sampleDoc, 17, 4, true)).toBe(5);
			expect(findNextCardLine(sampleDoc, 20, 4, true)).toBe(5);
		});

		test('returns null at end of file when wrapAround=false', () => {
			expect(findNextCardLine(sampleDoc, 17, 4, false)).toBeNull();
		});

		test('returns null when document has no card headings', () => {
			expect(findNextCardLine(['plain text'], 0, 4)).toBeNull();
		});
	});

	describe('findPreviousCardLine', () => {
		test('jumps to previous card heading from current line', () => {
			expect(findPreviousCardLine(sampleDoc, 17, 4)).toBe(11);
			expect(findPreviousCardLine(sampleDoc, 12, 4)).toBe(11);
			expect(findPreviousCardLine(sampleDoc, 11, 4)).toBe(5);
		});

		test('wraps around to last card when before first card with wrapAround=true', () => {
			expect(findPreviousCardLine(sampleDoc, 4, 4, true)).toBe(17);
			expect(findPreviousCardLine(sampleDoc, 5, 4, true)).toBe(17);
		});

		test('returns null at beginning of file when wrapAround=false', () => {
			expect(findPreviousCardLine(sampleDoc, 5, 4, false)).toBeNull();
		});
	});

	describe('findEnclosingCardBounds', () => {
		test('finds boundaries and text of card enclosing cursor line', () => {
			const bounds = findEnclosingCardBounds(sampleDoc, 7, 4);
			expect(bounds).not.toBeNull();
			expect(bounds?.startLine).toBe(5);
			expect(bounds?.endLine).toBe(10);
			expect(bounds?.cardText).toContain('#### First Card');
			expect(bounds?.cardText).toContain('<!--anki-id: 1234567890-->');
		});

		test('finds last card up to EOF', () => {
			const bounds = findEnclosingCardBounds(sampleDoc, 19, 4);
			expect(bounds).not.toBeNull();
			expect(bounds?.startLine).toBe(17);
			expect(bounds?.endLine).toBe(sampleDoc.length - 1);
		});

		test('returns null when cursor is before any card heading', () => {
			const bounds = findEnclosingCardBounds(sampleDoc, 2, 4);
			expect(bounds).toBeNull();
		});
	});

	describe('extractCardAnkiId', () => {
		test('extracts numeric Anki note ID', () => {
			const text = '#### Card\nQ ::: A\n<!--anki-id: 1712345678901-->';
			const result = extractCardAnkiId(text);
			expect(result).not.toBeNull();
			expect(result?.rawId).toBe('1712345678901');
			expect(result?.isNumeric).toBe(true);
			expect(result?.noteId).toBe(1712345678901);
		});

		test('extracts UUID Anki sync comment', () => {
			const text = '#### Card\nQ ::: A\n<!-- anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66 -->';
			const result = extractCardAnkiId(text);
			expect(result).not.toBeNull();
			expect(result?.rawId).toBe('f662895d-be31-4bd2-aa6f-1f8bf35dfa66');
			expect(result?.isNumeric).toBe(false);
			expect(result?.uuid).toBe('f662895d-be31-4bd2-aa6f-1f8bf35dfa66');
		});

		test('returns null when card has no anki-id comment', () => {
			const text = '#### Card\nQ ::: A\n<!-- regular comment -->';
			expect(extractCardAnkiId(text)).toBeNull();
		});
	});

	describe('findProblemCards & findNextProblemCardLine', () => {
		test('filters cards with skip, warn, or error outcomes', () => {
			const cards = [
				{ line: 5, outcome: 'sync', messages: [] },
				{ line: 15, outcome: 'warn', messages: ['Back region is empty'] },
				{ line: 25, outcome: 'error', messages: ['Delimiter mismatch'] },
				{ line: 35, outcome: 'skip', messages: ['Missing delimiter'] },
			];

			const problems = findProblemCards(cards);
			expect(problems.length).toBe(3);
			expect(problems[0].line).toBe(15);
			expect(problems[0].outcome).toBe('warn');
			expect(problems[1].line).toBe(25);
			expect(problems[1].outcome).toBe('error');
			expect(problems[2].line).toBe(35);
			expect(problems[2].outcome).toBe('skip');
		});

		test('finds next problem card after current line', () => {
			const problems = [
				{ line: 15, outcome: 'warn' as const, message: 'Warning 1' },
				{ line: 30, outcome: 'error' as const, message: 'Error 1' },
			];

			expect(findNextProblemCardLine(problems, 5)).toBe(15);
			expect(findNextProblemCardLine(problems, 15)).toBe(30);
			// Wrap around to first
			expect(findNextProblemCardLine(problems, 30)).toBe(15);
		});

		test('returns null when no problem cards exist', () => {
			expect(findNextProblemCardLine([], 10)).toBeNull();
		});
	});
});
