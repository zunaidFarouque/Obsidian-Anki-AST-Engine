import { describe, expect, test } from 'bun:test';
import {
	findCardHeadingLinePositions,
	type DocumentLine,
} from '../../plugin/src/cardPreviewUtils';

function line(from: number, text: string): DocumentLine {
	return { from, to: from + text.length, text };
}

describe('findCardHeadingLinePositions', () => {
	test('finds card-declaration headings after the body start offset', () => {
		const lines = [
			line(0, '---'),
			line(4, 'AnkiSync: on'),
			line(16, '---'),
			line(20, ''),
			line(21, '## Section'),
			line(32, '#### A1 Basic OK'),
			line(48, '#### A2 Basic SKIP'),
		];

		const headings = findCardHeadingLinePositions(lines, 4, 20);
		expect(headings).toHaveLength(2);
		expect(headings[0]).toEqual({ from: 32, to: 48 });
		expect(headings[1]).toEqual({ from: 48, to: 66 });
	});

	test('ignores shallower and deeper heading levels', () => {
		const lines = [
			line(0, '### Not a card'),
			line(18, '#### Card one'),
			line(32, '##### Too deep'),
			line(46, '#### Card two'),
		];

		const headings = findCardHeadingLinePositions(lines, 4, 0);
		expect(headings).toHaveLength(2);
		expect(headings[0]?.from).toBe(18);
		expect(headings[1]?.from).toBe(46);
	});

	test('returns empty when no headings match the configured level', () => {
		const lines = [line(0, '### Only h3 headings')];
		expect(findCardHeadingLinePositions(lines, 4, 0)).toEqual([]);
	});
});
