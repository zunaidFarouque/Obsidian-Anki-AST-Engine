import { describe, expect, test } from 'bun:test';
import {
	buildBackOnlyClozeWarningMeta,
	buildClozeTokenDecorations,
	buildDelimiterLineDecorations,
	buildHeadingBadgeModel,
	computeContentCacheKey,
	formatCardPreviewTooltip,
	frontmatterFromObsidianMetadata,
	hashString,
	outcomeToBadgeClass,
	pickPreviewMessage,
	shouldRebuildCardPreviewDecorations,
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

	test('computeContentCacheKey changes when note-type cache revision changes', () => {
		const base = computeContentCacheKey('Notes/card.md', '#### Q\n\n:::\n\nA', 0);
		const refreshed = computeContentCacheKey('Notes/card.md', '#### Q\n\n:::\n\nA', 1);
		expect(refreshed).not.toBe(base);
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

	test('buildHeadingBadgeModel applies warn visual precedence over sync', () => {
		const model = buildHeadingBadgeModel(
			makeCard({
				outcome: 'sync',
				messages: [{ level: 'warn', text: 'warn but still sync' }],
				resolvedType: builtinCardType('basic'),
			}),
		);
		expect(model.displayOutcome).toBe('warn');
		expect(model.label).toBe('basic ⚠️');
	});

	test('buildDelimiterLineDecorations marks first structural delimiter and discourages extras', () => {
		const card = makeCard({
			resolvedType: builtinCardType('reversible'),
			regions: {
				delimiters: [
					{ kind: ':::r', range: { start: 40, end: 44 } },
					{ kind: ':::', range: { start: 90, end: 93 } },
				],
			},
		});
		const decorations = buildDelimiterLineDecorations(card);
		expect(decorations).toHaveLength(2);
		expect(decorations[0]).toMatchObject({
			start: 40,
			end: 44,
			isPrimary: true,
			garnishText: '↑↓',
		});
		expect(decorations[1]).toMatchObject({
			start: 90,
			end: 93,
			isPrimary: false,
			discouragementText: 'Extra delimiter ignored (still Back region)',
		});
	});

	test('buildClozeTokenDecorations highlights text-region cloze with stable palette index', () => {
		const content = '#### Card\n{{c1::one}} and {{c5::two}}\n:::\n{{c1::back}}\n';
		const textEnd = content.indexOf('\n:::');
		const card = makeCard({
			resolvedType: builtinCardType('cloze'),
			regions: {
				text: { start: 10, end: textEnd },
				back: { start: textEnd + 4, end: content.length },
				delimiters: [{ kind: ':::', range: { start: textEnd + 1, end: textEnd + 4 } }],
			},
		});
		const tokens = buildClozeTokenDecorations(card, content);
		expect(tokens).toHaveLength(2);
		expect(tokens[0]?.groupId).toBe('c1');
		expect(tokens[1]?.groupId).toBe('c5');
		expect(tokens[0]?.paletteClass).toBe('anki-card-preview-cloze-group-1');
		expect(tokens[1]?.paletteClass).toBe('anki-card-preview-cloze-group-1');
	});

	test('buildClozeTokenDecorations skips custom noteTypes and basic cards', () => {
		const content = '{{c1::token}}';
		expect(
			buildClozeTokenDecorations(
				makeCard({ resolvedType: { kind: 'custom', noteTypeId: 'Vocab' } }),
				content,
			),
		).toEqual([]);
		expect(
			buildClozeTokenDecorations(makeCard({ resolvedType: builtinCardType('basic') }), content),
		).toEqual([]);
	});

	test('buildBackOnlyClozeWarningMeta surfaces warning hook in tooltip metadata', () => {
		const meta = buildBackOnlyClozeWarningMeta(
			makeCard({
				messages: [{ level: 'warn', text: 'Back-only {{}} found in Back region', ruleId: 'CLZ-11' }],
			}),
		);
		expect(meta).toEqual({
			hasBackOnlyWarning: true,
			ruleId: 'CLZ-11',
		});
	});

	test('frontmatterFromObsidianMetadata stringifies Obsidian property values', () => {
		expect(
			frontmatterFromObsidianMetadata({
				AnkiSync: true,
				cardDeclarationHeadingLevel: 4,
				anki_cardDefault: 'basic',
			}),
		).toEqual({
			AnkiSync: 'true',
			cardDeclarationHeadingLevel: '4',
			anki_cardDefault: 'basic',
		});
	});

	test('shouldRebuildCardPreviewDecorations rebuilds when live preview toggles', () => {
		expect(
			shouldRebuildCardPreviewDecorations({
				docChanged: false,
				viewportChanged: false,
				settingsRevision: 1,
				lastSettingsRevision: 1,
				livePreviewChanged: true,
				editorFileChanged: false,
			}),
		).toBe(true);
	});

	test('shouldRebuildCardPreviewDecorations skips when nothing changed', () => {
		expect(
			shouldRebuildCardPreviewDecorations({
				docChanged: false,
				viewportChanged: false,
				settingsRevision: 2,
				lastSettingsRevision: 2,
				livePreviewChanged: false,
				editorFileChanged: false,
			}),
		).toBe(false);
	});
});
