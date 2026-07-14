import { describe, expect, test } from 'bun:test';
import {
	buildLightweightTooltip,
	formatProblemForHeadingContext,
} from '../../plugin/src/cardPreviewUtils';
import {
	buildModalSections,
	buildStructureTemplateLines,
	insertTemplateAfterDeclarationHeading,
} from '../../plugin/src/cardPreviewModalContent';
import {
	builtinCardType,
	customCardType,
	type CardMessage,
	type ResolvedCard,
} from '../../src/cardSyntax/types';

function makeCard(overrides: Partial<ResolvedCard> = {}): ResolvedCard {
	return {
		title: 'Card heading',
		ordinal: 0,
		range: { start: 0, end: 60 },
		resolvedType: builtinCardType('basic'),
		resolvedFrom: 'file default',
		outcome: 'sync',
		messages: [],
		regions: { delimiters: [] },
		hashtags: { user: [], engine: [] },
		...overrides,
	};
}

describe('card preview tooltip + modal content', () => {
	test('lightweight tooltip shares hover Type/Situation/detail then resolvedFrom', () => {
		const tooltip = buildLightweightTooltip(
			makeCard({
				resolvedType: builtinCardType('typed'),
				resolvedFrom: 'inherited from ### Section',
				outcome: 'sync',
				messages: [{ level: 'warn', text: 'Typed answer has formatting — warning' }],
			}),
		);

		expect(tooltip).toBe(
			[
				'Type: typed',
				'Situation: warning',
				'Warning: Typed answer has formatting',
				'Resolved from: inherited from ### Section',
			].join('\n'),
		);
	});

	test('heading messaging distinguishes summary vs localized delimiter issues', () => {
		const localized: CardMessage = {
			level: 'error',
			text: 'Delimiter conflict on this line — error',
		};
		const summary: CardMessage = {
			level: 'warn',
			text: 'Card has inconsistent structure — warning',
		};

		expect(formatProblemForHeadingContext(localized)).toBe(
			'Localized line issue: Delimiter conflict on this line',
		);
		expect(formatProblemForHeadingContext(summary)).toBe(
			'Summary issue: Card has inconsistent structure',
		);
	});

	test('modal sections stay in design order', () => {
		const sections = buildModalSections(
			makeCard({
				messages: [{ level: 'skip', text: 'Missing required split' }],
			}),
		);
		expect(sections.map((section) => section.title)).toEqual([
			'Problems',
			'Current noteType structure',
			'Create other noteTypes',
			'Resolution reasoning',
			'Actions',
		]);
	});
});

describe('template insertion action', () => {
	test('inserts typed template right after declaration heading without overwrite', () => {
		const content = '#### Card heading\nExisting line 1\nExisting line 2\n';
		const result = insertTemplateAfterDeclarationHeading(
			content,
			0,
			buildStructureTemplateLines(builtinCardType('typed')),
		);

		expect(result).toBe(
			'#### Card heading\nQuestion\n:::t\nanswer\nExisting line 1\nExisting line 2\n',
		);
	});

	test('creates custom template blocks for each field', () => {
		const lines = buildStructureTemplateLines(customCardType('Vocab'), [
			'Word',
			'Definition',
		]);
		expect(lines).toEqual(['::: Word', '::: Definition']);
	});
});
