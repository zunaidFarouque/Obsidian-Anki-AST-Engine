import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
	cardFollowsSectionHeading,
	shouldPaintInterCardTail,
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

	test('shouldPaintInterCardTail is true only when a following card exists and gap is positive', () => {
		// Overlay-only contract: tail mask uses absolute ::after, never padding/margin on cm-line.
		expect(shouldPaintInterCardTail(true, 0.28)).toBe(true);
		expect(shouldPaintInterCardTail(true, 0)).toBe(false);
		expect(shouldPaintInterCardTail(false, 0.28)).toBe(false);
	});

	test('section-start overlay extends cardblock ::before upward on heading lines', () => {
		const css = readFileSync(join(import.meta.dir, '../../plugin/styles.css'), 'utf8');
		expect(css).toMatch(
			/\.anki-card-preview-cardblock\.anki-card-preview-heading--section-start[\s\S]*::before/,
		);
		expect(css).not.toMatch(/\.anki-card-preview-envelope-layer/);
	});

	test('declaration heading keeps separate background token on cardblock lines for guides', () => {
		const css = readFileSync(join(import.meta.dir, '../../plugin/styles.css'), 'utf8');
		expect(css).toContain('--anki-cardblock-heading-bg');
		expect(css).toMatch(/\.cm-line\.anki-card-preview-cardblock[\s\S]*--anki-cardblock-heading-bg/);
	});

	describe('overlay-only layout contract', () => {
		const cssPath = join(import.meta.dir, '../../plugin/styles.css');
		const css = () => readFileSync(cssPath, 'utf8');

		test('cardblock cm-line carries tokens only without per-line paint', () => {
			const rule = css().match(/\.cm-line\.anki-card-preview-cardblock\s*\{[^}]+\}/s)?.[0];
			expect(rule).toBeDefined();
			expect(rule).not.toMatch(/padding/);
			expect(rule).not.toMatch(/border-left/);
			expect(rule).not.toMatch(/background:/);
			expect(rule).not.toMatch(/box-shadow:/);
		});

		test('heading cm-line has no padding or flow-root', () => {
			const rule = css().match(/\.cm-line\.anki-card-preview-heading\s*\{[^}]+\}/)?.[0];
			expect(rule).toBeDefined();
			expect(rule).not.toMatch(/padding/);
			expect(rule).not.toMatch(/flow-root/);
		});

		test('badge uses absolute overlay slot pattern', () => {
			const stylesheet = css();
			const slotRule = stylesheet.match(/\.anki-card-preview-badge-slot\s*\{[^}]+\}/)?.[0];
			expect(slotRule).toBeDefined();
			expect(slotRule).toMatch(/width:\s*0/);
			expect(slotRule).toMatch(/overflow:\s*visible/);
			const badgeRule = stylesheet.match(/\.anki-card-preview-badge\s*\{[^}]+\}/)?.[0];
			expect(badgeRule).toBeDefined();
			expect(badgeRule).toMatch(/position:\s*absolute/);
			expect(badgeRule).not.toMatch(/float/);
			expect(badgeRule).not.toMatch(/margin-left/);
		});

		test('delimiter extra uses line ::after without span margin', () => {
			const stylesheet = css();
			expect(stylesheet).toMatch(/\.cm-line\.anki-card-preview-delimiter-extra::after/);
			expect(stylesheet).not.toMatch(
				/\.cm-content\s+\.anki-card-preview-delimiter-extra\s*\{[^}]*margin-left/,
			);
		});

		test('cloze token mark has no padding', () => {
			const rule = css().match(/\.anki-card-preview-cloze-token\s*\{[^}]+\}/)?.[0];
			expect(rule).toBeDefined();
			expect(rule).not.toMatch(/padding/);
		});

		test('cardblock ::before underlay bleeds outward without layout shift', () => {
			const stylesheet = css();
			expect(stylesheet).toContain('--anki-card-preview-block-bleed: 0.5em');
			expect(stylesheet).toMatch(
				/\.anki-card-preview-cardblock:not\(\.anki-card-preview-delimiter-guide\)::before/,
			);
			expect(stylesheet).toMatch(/border-left:\s*2px solid var\(--anki-cardblock-border-color\)/);
			expect(stylesheet).toMatch(/\.anki-card-preview-cardblock--tail[\s\S]*::before/);
			expect(stylesheet).not.toMatch(/\.anki-card-preview-envelope/);
		});
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
