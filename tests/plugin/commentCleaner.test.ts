import { describe, expect, test } from 'bun:test';
import { removeAnkiSyncComments } from '../../plugin/src/commentCleanerUtils';

describe('removeAnkiSyncComments', () => {
	test('removes standard UUID anki-id sync comments', () => {
		const input = [
			'### Question 1',
			'What is the speed of light? ::: 3x10^8 m/s',
			'<!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->',
			'',
			'### Question 2',
			'What is gravity? ::: 9.8 m/s^2',
			'<!--anki-id: 3b082fd4-5401-455f-a807-68b3c8a0f9cf-->',
		].join('\n');

		const expected = [
			'### Question 1',
			'What is the speed of light? ::: 3x10^8 m/s',
			'',
			'### Question 2',
			'What is gravity? ::: 9.8 m/s^2',
		].join('\n');

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(2);
	});

	test('handles whitespace and case variations in anki-id comments', () => {
		const input = [
			'Card 1 ::: Back 1',
			'<!-- anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66 -->',
			'Card 2 ::: Back 2',
			'<!--ANKI-ID: 3B082FD4-5401-455F-A807-68B3C8A0F9CF-->',
			'Card 3 ::: Back 3',
			'<!--anki-id:f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->',
		].join('\n');

		const expected = [
			'Card 1 ::: Back 1',
			'Card 2 ::: Back 2',
			'Card 3 ::: Back 3',
		].join('\n');

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(3);
	});

	test('removes empty or unassigned anki-id comments', () => {
		const input = [
			'Card 1',
			'<!-- anki-id: -->',
			'Card 2',
			'<!-- anki-id -->',
			'Card 3',
			'<!--anki-id-->',
		].join('\n');

		const expected = ['Card 1', 'Card 2', 'Card 3'].join('\n');

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(3);
	});

	test('strictly preserves non-sync HTML comments', () => {
		const input = [
			'<!-- note: keep this important author comment -->',
			'### Flashcard',
			'Question ::: Answer',
			'<!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->',
			'',
			'<!-- expect: 42 -->',
			'<!-- anki-ideas: brainstorm for future cards -->',
			'<!-- note: anki-id explanation goes here -->',
			'<div><!-- comment inside html --></div>',
		].join('\n');

		const expected = [
			'<!-- note: keep this important author comment -->',
			'### Flashcard',
			'Question ::: Answer',
			'',
			'<!-- expect: 42 -->',
			'<!-- anki-ideas: brainstorm for future cards -->',
			'<!-- note: anki-id explanation goes here -->',
			'<div><!-- comment inside html --></div>',
		].join('\n');

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(1);
	});

	test('strictly preserves Obsidian comments (%% ... %%)', () => {
		const input = [
			'%% anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66 %%',
			'Card 1 ::: Back 1',
			'<!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->',
			'%% regular obsidian comment %%',
		].join('\n');

		const expected = [
			'%% anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66 %%',
			'Card 1 ::: Back 1',
			'%% regular obsidian comment %%',
		].join('\n');

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(1);
	});

	test('collapses redundant blank lines when comment is surrounded by blank lines', () => {
		const input = [
			'Card 1 ::: Answer 1',
			'',
			'<!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->',
			'',
			'### Card 2',
			'Card 2 ::: Answer 2',
		].join('\n');

		const expected = [
			'Card 1 ::: Answer 1',
			'',
			'### Card 2',
			'Card 2 ::: Answer 2',
		].join('\n');

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(1);
	});

	test('handles comments in callouts and blockquotes', () => {
		const input = [
			'> [!note]',
			'> Question ::: Answer',
			'> <!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->',
			'>',
			'> Next content',
		].join('\n');

		const expected = [
			'> [!note]',
			'> Question ::: Answer',
			'>',
			'> Next content',
		].join('\n');

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(1);
	});

	test('collapses redundant empty blockquote lines around comments in callouts', () => {
		const input = [
			'> Question ::: Answer',
			'>',
			'> <!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->',
			'>',
			'> Next paragraph',
		].join('\n');

		const expected = [
			'> Question ::: Answer',
			'>',
			'> Next paragraph',
		].join('\n');

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(1);
	});

	test('removes inline comments without leaving trailing whitespace', () => {
		const input = 'Question ::: Answer <!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->';
		const expected = 'Question ::: Answer';

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(1);
	});

	test('removes multiple inline comments on the same line', () => {
		const input =
			'C1 <!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66--> and C2 <!--anki-id: 3b082fd4-5401-455f-a807-68b3c8a0f9cf-->';
		const expected = 'C1 and C2';

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(2);
	});

	test('removes comments at the end of file cleanly', () => {
		const input = 'Card 1 ::: Answer 1\n<!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->';
		const expected = 'Card 1 ::: Answer 1';

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(1);
	});

	test('removes comment at end of file with blank line before it', () => {
		const input = 'Card 1 ::: Answer 1\n\n<!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->';
		const expected = 'Card 1 ::: Answer 1\n';

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(1);
	});

	test('preserves CRLF line endings', () => {
		const input =
			'Card 1 ::: Answer 1\r\n<!--anki-id: f662895d-be31-4bd2-aa6f-1f8bf35dfa66-->\r\n\r\nCard 2 ::: Answer 2';
		const expected = 'Card 1 ::: Answer 1\r\n\r\nCard 2 ::: Answer 2';

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(expected);
		expect(result.count).toBe(1);
	});

	test('returns original text and count 0 when no anki-id comments exist', () => {
		const input = [
			'# Regular Note',
			'Some regular text without any sync comments.',
			'<!-- note: this should stay -->',
		].join('\n');

		const result = removeAnkiSyncComments(input);
		expect(result.text).toBe(input);
		expect(result.count).toBe(0);
	});
});
