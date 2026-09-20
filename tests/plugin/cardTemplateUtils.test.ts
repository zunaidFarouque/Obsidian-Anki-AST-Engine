import { describe, expect, test } from 'bun:test';
import {
	buildCardTemplate,
	buildCustomNoteTypeTemplate,
	findExistingClozeIndexes,
	resolveDelimiter,
	resolveHeadingLevel,
	wrapWithCloze,
} from '../../plugin/src/helpers/cardTemplateUtils';

describe('cardTemplateUtils', () => {
	describe('resolveHeadingLevel', () => {
		test('returns valid frontmatter level between 1 and 6', () => {
			expect(resolveHeadingLevel(3, 4)).toBe(3);
			expect(resolveHeadingLevel(1, 4)).toBe(1);
			expect(resolveHeadingLevel(6, 4)).toBe(6);
		});

		test('parses string heading level numbers', () => {
			expect(resolveHeadingLevel('2', 4)).toBe(2);
			expect(resolveHeadingLevel('5', 4)).toBe(5);
		});

		test('falls back to setting when frontmatter level is invalid or missing', () => {
			expect(resolveHeadingLevel(null, 4)).toBe(4);
			expect(resolveHeadingLevel(undefined, 3)).toBe(3);
			expect(resolveHeadingLevel(0, 4)).toBe(4);
			expect(resolveHeadingLevel(7, 4)).toBe(4);
			expect(resolveHeadingLevel('invalid', 4)).toBe(4);
		});
	});

	describe('resolveDelimiter', () => {
		test('returns frontmatter delimiter when provided', () => {
			expect(resolveDelimiter('?', ':::')).toBe('?');
			expect(resolveDelimiter('---', ':::')).toBe('---');
		});

		test('falls back to default delimiter when null, undefined, or empty', () => {
			expect(resolveDelimiter(null, ':::')).toBe(':::');
			expect(resolveDelimiter(undefined, ':::')).toBe(':::');
			expect(resolveDelimiter('   ', ':::')).toBe(':::');
		});
	});

	describe('buildCardTemplate (Phase 1)', () => {
		test('builds Basic card template with specified heading level and delimiter', () => {
			const result = buildCardTemplate('basic', {
				headingLevel: 4,
				delimiter: ':::',
				hasLeadingContent: false,
			});

			expect(result.text).toBe('#### Card Title\nFront text\n:::\nBack text\n');
			// Placeholder selection should encompass "Card Title"
			const selectedPlaceholder = result.text.slice(
				result.placeholderSelection.startOffset,
				result.placeholderSelection.endOffset,
			);
			expect(selectedPlaceholder).toBe('Card Title');
		});

		test('prefixes double newline when hasLeadingContent is true', () => {
			const result = buildCardTemplate('basic', {
				headingLevel: 4,
				hasLeadingContent: true,
			});

			expect(result.text.startsWith('\n\n#### ')).toBe(true);
			const selectedPlaceholder = result.text.slice(
				result.placeholderSelection.startOffset,
				result.placeholderSelection.endOffset,
			);
			expect(selectedPlaceholder).toBe('Card Title');
		});

		test('embeds selectedText into Front region when selectedText is provided', () => {
			const result = buildCardTemplate('basic', {
				headingLevel: 3,
				selectedText: 'What is photosynthesis?',
				hasLeadingContent: false,
			});

			expect(result.text).toBe('### Card Title\nWhat is photosynthesis?\n:::\nBack text\n');
		});

		test('builds Reversible card template with :::r', () => {
			const result = buildCardTemplate('reversible', {
				headingLevel: 4,
				hasLeadingContent: false,
			});

			expect(result.text).toBe('#### Term\nFront\n:::r\nBack\n');
			const selectedPlaceholder = result.text.slice(
				result.placeholderSelection.startOffset,
				result.placeholderSelection.endOffset,
			);
			expect(selectedPlaceholder).toBe('Term');
		});

		test('builds Typed card template with :::t', () => {
			const result = buildCardTemplate('typed', {
				headingLevel: 4,
				hasLeadingContent: false,
			});

			expect(result.text).toBe('#### Prompt\nQuestion\n:::t\nAnswer\n');
			const selectedPlaceholder = result.text.slice(
				result.placeholderSelection.startOffset,
				result.placeholderSelection.endOffset,
			);
			expect(selectedPlaceholder).toBe('Prompt');
		});

		test('builds Cloze card template with cloze syntax', () => {
			const result = buildCardTemplate('cloze', {
				headingLevel: 4,
				hasLeadingContent: false,
			});

			expect(result.text).toBe('#### Cloze Note\nThe {{c1::cloze deletion}} goes here.\n:::\nOptional back extra\n');
		});

		test('embeds selectedText into Cloze card Text region', () => {
			const result = buildCardTemplate('cloze', {
				headingLevel: 4,
				selectedText: 'Mitochondria is the powerhouse of the cell.',
				hasLeadingContent: false,
			});

			expect(result.text).toBe('#### Cloze Note\n{{c1::Mitochondria is the powerhouse of the cell.}}\n:::\nOptional back extra\n');
		});
	});

	describe('buildCustomNoteTypeTemplate (Phase 2)', () => {
		test('formats custom note type with tag and field delimiters', () => {
			const result = buildCustomNoteTypeTemplate({
				noteTypeName: 'Japanese Vocab',
				fields: ['Expression', 'Reading', 'Meaning'],
				headingLevel: 4,
				hasLeadingContent: false,
			});

			const expected = [
				'#### Japanese Vocab Item #anki/noteType/Japanese-Vocab',
				'::: Expression',
				'',
				'::: Reading',
				'',
				'::: Meaning',
				'',
			].join('\n') + '\n';

			expect(result.text).toBe(expected);
			const selectedPlaceholder = result.text.slice(
				result.placeholderSelection.startOffset,
				result.placeholderSelection.endOffset,
			);
			expect(selectedPlaceholder).toBe('Japanese Vocab Item');
		});

		test('uses fallback fields Front and Back when field list is empty', () => {
			const result = buildCustomNoteTypeTemplate({
				noteTypeName: 'CustomType',
				fields: [],
				headingLevel: 4,
				hasLeadingContent: false,
			});

			expect(result.text).toContain('#### CustomType Item #anki/noteType/CustomType\n::: Front\n\n::: Back\n\n');
		});
	});

	describe('findExistingClozeIndexes (Phase 2)', () => {
		test('extracts single cloze number', () => {
			expect(findExistingClozeIndexes('The {{c1::quick}} brown fox')).toEqual([1]);
		});

		test('extracts multiple cloze numbers in order without duplicates', () => {
			const text = '{{c1::A}} and {{c2::B}} and {{c1::C}} and {{c4::D}}';
			expect(findExistingClozeIndexes(text)).toEqual([1, 2, 4]);
		});

		test('returns empty array when no standard clozes exist', () => {
			expect(findExistingClozeIndexes('Regular text with {{shorthand}} cloze')).toEqual([]);
			expect(findExistingClozeIndexes('')).toEqual([]);
		});
	});

	describe('wrapWithCloze (Phase 2)', () => {
		test('wraps selected text as c1 when no prior clozes exist', () => {
			const result = wrapWithCloze({
				selectedText: 'mitochondria',
				enclosingCardText: 'The powerhouse is the cell organelle.',
			});

			expect(result.replacement).toBe('{{c1::mitochondria}}');
			expect(result.clozeIndex).toBe(1);
			expect(result.cursorOffset).toBe('{{c1::mitochondria}}'.length);
		});

		test('auto-increments cloze index based on existing clozes in card text', () => {
			const cardText = 'The {{c1::first}} and {{c2::second}} items.';
			const result = wrapWithCloze({
				selectedText: 'third',
				enclosingCardText: cardText,
			});

			expect(result.replacement).toBe('{{c3::third}}');
			expect(result.clozeIndex).toBe(3);
		});

		test('generates empty cloze with cursor placed inside when selectedText is empty', () => {
			const result = wrapWithCloze({
				selectedText: '',
				enclosingCardText: '{{c1::first}}',
			});

			expect(result.replacement).toBe('{{c2::}}');
			expect(result.clozeIndex).toBe(2);
			// Cursor should be right before the closing "}}"
			expect(result.cursorOffset).toBe('{{c2:'.length + 1);
		});

		test('supports shorthand mode when requested', () => {
			const result = wrapWithCloze({
				selectedText: 'glucose',
				shorthand: true,
			});

			expect(result.replacement).toBe('{{glucose}}');
			expect(result.clozeIndex).toBe(1);
			expect(result.cursorOffset).toBe('{{glucose}}'.length);
		});
	});
});
