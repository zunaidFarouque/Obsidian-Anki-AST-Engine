import { describe, expect, test } from 'bun:test';
import {
	buildBackOnlyClozeWarningMeta,
	buildClozeTokenDecorations,
	buildDelimiterLineDecorations,
	buildHeadingBadgeModel,
	computeContentCacheKey,
	formatCardPreviewTooltip,
	formatProblemForHeadingContext,
	frontmatterFromObsidianMetadata,
	hashString,
	outcomeToBadgeClass,
	pickPreviewMessage,
	shouldRebuildCardPreviewDecorations,
	stripCanonicalOutcomeSuffix,
	zipCardsToHeadings,
} from '../../plugin/src/cardPreviewUtils';
import {
	builtinCardType,
	customCardType,
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

	test('stripCanonicalOutcomeSuffix removes trailing outcome markers only', () => {
		expect(
			stripCanonicalOutcomeSuffix(
				'Card "A2": basic card missing ::: delimiter — skipped',
			),
		).toBe('Card "A2": basic card missing ::: delimiter');
		expect(
			stripCanonicalOutcomeSuffix('Card "A3": {{username}} treated as literal — warning'),
		).toBe('Card "A3": {{username}} treated as literal');
		expect(stripCanonicalOutcomeSuffix('Conflict — error')).toBe('Conflict');
		expect(stripCanonicalOutcomeSuffix('do not strip — skipped mid — keep')).toBe(
			'do not strip — skipped mid — keep',
		);
		expect(stripCanonicalOutcomeSuffix('plain message')).toBe('plain message');
	});

	test('formatCardPreviewTooltip is Type only for healthy sync', () => {
		expect(
			formatCardPreviewTooltip({
				resolvedType: builtinCardType('basic'),
				messages: [],
				outcome: 'sync',
			}),
		).toBe('Type: basic');
	});

	test('formatCardPreviewTooltip uses Situation and Problem for skip', () => {
		expect(
			formatCardPreviewTooltip({
				resolvedType: builtinCardType('basic'),
				outcome: 'skip',
				messages: [
					{
						level: 'skip',
						text: 'Card "A2 Basic SKIP No Delimiter": basic card missing ::: delimiter — skipped',
					},
				],
			}),
		).toBe(
			[
				'Type: basic',
				'Situation: skipped',
				'Problem: Card "A2 Basic SKIP No Delimiter": basic card missing ::: delimiter',
			].join('\n'),
		);
	});

	test('formatCardPreviewTooltip uses Situation and Warning for warn', () => {
		expect(
			formatCardPreviewTooltip({
				resolvedType: builtinCardType('basic'),
				outcome: 'sync',
				messages: [
					{
						level: 'warn',
						text: 'Card "A3 Basic WARN Bare Mustache": {{username}} treated as literal on basic card — warning',
					},
				],
			}),
		).toBe(
			[
				'Type: basic',
				'Situation: warning',
				'Warning: Card "A3 Basic WARN Bare Mustache": {{username}} treated as literal on basic card',
			].join('\n'),
		);
	});

	test('formatCardPreviewTooltip keeps Warning label when warn has no suffix', () => {
		expect(
			formatCardPreviewTooltip({
				resolvedType: builtinCardType('cloze'),
				outcome: 'sync',
				messages: [{ level: 'warn', text: 'Bare {{}} in text' }],
			}),
		).toBe('Type: cloze\nSituation: warning\nWarning: Bare {{}} in text');
	});

	test('formatCardPreviewTooltip uses Situation and Problem for error', () => {
		expect(
			formatCardPreviewTooltip({
				resolvedType: builtinCardType('basic'),
				outcome: 'error',
				messages: [
					{
						level: 'error',
						text: 'Card "F1": :::r conflicts with resolved type "basic" — error',
					},
				],
			}),
		).toBe(
			[
				'Type: basic',
				'Situation: error',
				'Problem: Card "F1": :::r conflicts with resolved type "basic"',
			].join('\n'),
		);
	});

	test('formatCardPreviewTooltip uses noteType wording for custom types', () => {
		expect(
			formatCardPreviewTooltip({
				resolvedType: customCardType('Vocab'),
				outcome: 'sync',
				messages: [{ level: 'warn', text: 'Unknown custom field' }],
			}),
		).toBe('Type: noteType: Vocab\nSituation: warning\nWarning: Unknown custom field');
	});

	test('formatCardPreviewTooltip uses Situation and Info for info-only', () => {
		expect(
			formatCardPreviewTooltip({
				resolvedType: builtinCardType('basic'),
				outcome: 'sync',
				messages: [{ level: 'info', text: 'Resolved cloze inherited from section' }],
			}),
		).toBe(
			['Type: basic', 'Situation: info', 'Info: Resolved cloze inherited from section'].join(
				'\n',
			),
		);
	});

	test('formatCardPreviewTooltip prefers error over warn for Situation and detail', () => {
		expect(
			formatCardPreviewTooltip({
				resolvedType: builtinCardType('basic'),
				outcome: 'sync',
				messages: [
					{ level: 'warn', text: 'warn — warning' },
					{ level: 'error', text: 'bad conflict — error' },
				],
			}),
		).toBe('Type: basic\nSituation: error\nProblem: bad conflict');
	});

	test('formatProblemForHeadingContext strips canonical outcome suffixes', () => {
		expect(
			formatProblemForHeadingContext({
				level: 'skip',
				text: 'Card "A2": basic card missing ::: delimiter — skipped',
			}),
		).toBe('Localized line issue: Card "A2": basic card missing ::: delimiter');
		expect(
			formatProblemForHeadingContext({
				level: 'warn',
				text: 'Card has inconsistent structure — warning',
			}),
		).toBe('Summary issue: Card has inconsistent structure');
		expect(
			formatProblemForHeadingContext({
				level: 'error',
				text: 'Delimiter conflict on this line — error',
			}),
		).toBe('Localized line issue: Delimiter conflict on this line');
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
