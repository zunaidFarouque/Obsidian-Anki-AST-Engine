import { describe, expect, test } from 'bun:test';
import {
	cardFollowsSectionHeading,
	findInterCardGapLineStart,
	formatCardPreviewInterCardGap,
	formatCardPreviewSectionTopExtend,
	parseMarkdownHeadingLevel,
} from '../../plugin/src/cardPreviewLayout';
import type { DocumentLine } from '../../plugin/src/cardPreviewUtils';
import type { AnkiAstSyncSettings } from '../../plugin/src/settings';

function linesFromDoc(doc: string): DocumentLine[] {
	const result: DocumentLine[] = [];
	let from = 0;
	for (const text of doc.split('\n')) {
		result.push({ from, to: from + text.length, text });
		from += text.length + 1;
	}
	return result;
}

describe('cardPreviewLayout', () => {
	test('parseMarkdownHeadingLevel reads ATX heading depth', () => {
		expect(parseMarkdownHeadingLevel('### Subsection')).toBe(3);
		expect(parseMarkdownHeadingLevel('#### Card')).toBe(4);
		expect(parseMarkdownHeadingLevel('plain text')).toBeNull();
	});

	test('detects section start vs card-after-card context', () => {
		const doc = ['### Subsection A0', '', '#### Card A', 'Front', '', '#### Card B'].join('\n');
		const lines = linesFromDoc(doc);
		const cardAFrom = doc.indexOf('#### Card A');
		const cardBFrom = doc.indexOf('#### Card B');

		expect(cardFollowsSectionHeading(lines, cardAFrom, 4)).toBe(true);
		expect(cardFollowsSectionHeading(lines, cardBFrom, 4)).toBe(false);
	});

	test('finds inter-card gap line only before cards that follow another card', () => {
		const doc = ['### Subsection A0', '', '#### Card A', 'Front', '', '#### Card B'].join('\n');
		const lines = linesFromDoc(doc);
		const cardAFrom = doc.indexOf('#### Card A');
		const cardBFrom = doc.indexOf('#### Card B');
		const blankBeforeB = lines.find((line, index, all) => {
			return line.text === '' && all[index + 1]?.from === cardBFrom;
		})!.from;

		expect(findInterCardGapLineStart(lines, cardAFrom, 4)).toBeUndefined();
		expect(findInterCardGapLineStart(lines, cardBFrom, 4)).toBe(blankBeforeB);
	});

	test('formats layout css variables', () => {
		expect(
			formatCardPreviewSectionTopExtend({ cardPreviewSectionTopExtend: 0.5 } as AnkiAstSyncSettings),
		).toBe('calc(0.5 * 1lh)');
		expect(
			formatCardPreviewSectionTopExtend({ cardPreviewSectionTopExtend: 0 } as AnkiAstSyncSettings),
		).toBe('0px');
		expect(formatCardPreviewInterCardGap({ cardPreviewInterCardGapEm: 0.28 } as AnkiAstSyncSettings)).toBe(
			'0.28em',
		);
	});
});
