import { describe, expect, test } from 'bun:test';
import {
	computeContentCacheKey,
	formatCardPreviewTooltip,
	hashString,
	outcomeToBadgeClass,
	pickPreviewMessage,
	zipCardsToHeadings,
} from '../../plugin/src/cardPreviewUtils';
import {
	builtinCardType,
	type CardMessage,
	type ResolvedCard,
} from '../../src/cardSyntax/types';

function makeCard(overrides: Partial<ResolvedCard> = {}): ResolvedCard {
	return {
		title: 'Example',
		ordinal: 0,
		range: { start: 0, end: 1 },
		resolvedType: builtinCardType('basic'),
		resolvedFrom: 'file default',
		outcome: 'sync',
		messages: [],
		regions: { delimiters: [] },
		hashtags: { user: [], engine: [] },
		...overrides,
	};
}

describe('cardPreviewUtils', () => {
	test('hashString is stable for the same content', () => {
		expect(hashString('hello')).toBe(hashString('hello'));
		expect(hashString('hello')).not.toBe(hashString('hello!'));
	});

	test('computeContentCacheKey includes path, length, and hash', () => {
		const key = computeContentCacheKey('Notes/card.md', '#### Q\n\n:::\n\nA');
		expect(key.startsWith('Notes/card.md:')).toBe(true);
		expect(computeContentCacheKey('Notes/card.md', '#### Q\n\n:::\n\nA')).toBe(key);
		expect(computeContentCacheKey('Notes/other.md', '#### Q\n\n:::\n\nA')).not.toBe(key);
	});

	test('outcomeToBadgeClass maps sync outcomes to css suffixes', () => {
		expect(outcomeToBadgeClass('sync')).toBe('sync');
		expect(outcomeToBadgeClass('warn')).toBe('warn');
		expect(outcomeToBadgeClass('skip')).toBe('skip');
		expect(outcomeToBadgeClass('error')).toBe('error');
	});

	test('pickPreviewMessage prefers errors then warnings', () => {
		const messages: CardMessage[] = [
			{ level: 'info', text: 'info' },
			{ level: 'warn', text: 'warn' },
			{ level: 'error', text: 'error' },
		];
		expect(pickPreviewMessage(messages)).toBe('error');
		expect(pickPreviewMessage([{ level: 'warn', text: 'warn' }])).toBe('warn');
	});

	test('formatCardPreviewTooltip includes resolved type and first message', () => {
		expect(
			formatCardPreviewTooltip({
				resolvedType: builtinCardType('cloze'),
				messages: [{ level: 'warn', text: 'Bare {{}} in text' }],
			}),
		).toBe('cloze — Bare {{}} in text');
	});

	test('zipCardsToHeadings pairs by document order up to the shorter list', () => {
		const cards = [makeCard({ title: 'A' }), makeCard({ title: 'B' })];
		const headings = [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }];
		const pairs = zipCardsToHeadings(cards, headings);
		expect(pairs).toHaveLength(2);
		expect(pairs[0]?.card.title).toBe('A');
		expect(pairs[0]?.heading.id).toBe('h1');
		expect(pairs[1]?.card.title).toBe('B');
	});
});
