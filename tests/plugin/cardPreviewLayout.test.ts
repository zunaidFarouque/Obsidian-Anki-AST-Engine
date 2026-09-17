import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
	cardFollowsSectionHeading,
	findBeforeMidCardHrLineStarts,
	formatCardPreviewInterCardGap,
	formatCardPreviewSectionTopExtend,
	isBlankDocumentLine,
	isMarkdownThematicBreakLine,
	parseMarkdownHeadingLevel,
	shouldPaintInterCardTail,
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

function cssCmContentRule(stylesheet: string): string | undefined {
	return stylesheet.match(
		/\.markdown-source-view\.is-live-preview\s+\.cm-content\s*\{[^}]+\}/s,
	)?.[0];
}

function cssPaintHostFormulaRule(stylesheet: string): string | undefined {
	// Grouped host selector: cardblock, table sibling, before-mid-hr + .hr
	return stylesheet.match(
		/\.cm-line\.anki-card-preview-cardblock\s*,[\s\S]*?before-mid-hr[\s\S]*?\+ \.hr\.cm-line\s*\{[^}]+\}/s,
	)?.[0];
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

	test('shouldPaintInterCardTail skips when next line is non-blank (e.g. anki-id)', () => {
		expect(shouldPaintInterCardTail(true, 0.28, true)).toBe(true);
		expect(shouldPaintInterCardTail(true, 0.28, false)).toBe(false);
		expect(isBlankDocumentLine('')).toBe(true);
		expect(isBlankDocumentLine('<!--anki-id: 55b5de48-795e-4722-915d-7b6e9c24e203-->')).toBe(
			false,
		);
		expect(
			shouldPaintInterCardTail(
				true,
				0.28,
				isBlankDocumentLine('<!--anki-id: 55b5de48-795e-4722-915d-7b6e9c24e203-->'),
			),
		).toBe(false);
	});

	test('unified card envelope layer is declared in styles', () => {
		const css = readFileSync(join(import.meta.dir, '../../plugin/styles.css'), 'utf8');
		expect(css).toMatch(/\.cm-layer-anki-envelope/);
		expect(css).toMatch(/\.anki-card-envelope/);
	});

	test('card envelope base rule defines background and accent border', () => {
		const css = readFileSync(join(import.meta.dir, '../../plugin/styles.css'), 'utf8');
		const envelopeRule = css.match(/\.anki-card-envelope\s*\{[^}]+\}/s)?.[0];
		expect(envelopeRule).toBeDefined();
		expect(envelopeRule).toMatch(/background:\s*var\(--anki-cardblock-paint\)/);
		expect(envelopeRule).toMatch(/border-left:\s*2px solid var\(--anki-cardblock-border-color\)/);
		expect(envelopeRule).toMatch(/border-radius:\s*4px/);
	});

	test('default tint inputs on .anki-card-envelope', () => {
		const stylesheet = readFileSync(join(import.meta.dir, '../../plugin/styles.css'), 'utf8');
		const envelopeRule = stylesheet.match(/\.anki-card-envelope\s*\{[^}]+\}/s)?.[0];
		expect(envelopeRule).toBeDefined();
		expect(envelopeRule).toMatch(/--anki-cardblock-tint:\s*var\(--background-modifier-hover\)/);
		expect(envelopeRule).toMatch(/--anki-cardblock-body-opacity:\s*38%/);
		expect(envelopeRule).toMatch(/--anki-cardblock-border-color:\s*var\(--background-modifier-border\)/);
		expect(envelopeRule).toMatch(
			/--anki-cardblock-bg:\s*color-mix\([^;]*var\(--anki-cardblock-tint\)[^;]*var\(--anki-cardblock-body-opacity\)/,
		);
	});

	test('skip block uses half-opacity neutral background of sync', () => {
		const stylesheet = readFileSync(join(import.meta.dir, '../../plugin/styles.css'), 'utf8');
		const syncRule = stylesheet.match(/\.anki-card-envelope--sync\b[^{]*\{[^}]+\}/s)?.[0];
		const skipRule = stylesheet.match(/\.anki-card-envelope--skip\b[^{]*\{[^}]+\}/s)?.[0];
		expect(syncRule).toBeDefined();
		expect(skipRule).toBeDefined();
		const syncBodyOpacity = Number(
			syncRule!.match(/--anki-cardblock-body-opacity:\s*([\d.]+)%/)?.[1],
		);
		const skipBodyOpacity = Number(
			skipRule!.match(/--anki-cardblock-body-opacity:\s*([\d.]+)%/)?.[1],
		);
		expect(skipRule).toMatch(/--anki-cardblock-tint:\s*var\(--background-modifier-hover\)/);
		expect(skipBodyOpacity).toBe(syncBodyOpacity / 2);
	});

	test('outcome variants set tint tokens on card envelope classes', () => {
		const stylesheet = readFileSync(join(import.meta.dir, '../../plugin/styles.css'), 'utf8');
		for (const variant of ['sync', 'warn', 'skip', 'error'] as const) {
			const rule = stylesheet.match(
				new RegExp(`\\.anki-card-envelope--${variant}\\b[^\\{]*\\{[^}]+\\}`, 's'),
			)?.[0];
			expect(rule).toBeDefined();
			expect(rule).toMatch(/--anki-cardblock-tint/);
			expect(rule).toMatch(/--anki-cardblock-body-opacity/);
			expect(rule).toMatch(/--anki-cardblock-border-color/);
		}
	});

	describe('overlay-only layout contract', () => {
		const cssPath = join(import.meta.dir, '../../plugin/styles.css');
		const css = () => readFileSync(cssPath, 'utf8');

		test('cardblock cm-line uses overlay paint without layout shift', () => {
			const rule = css().match(/\.cm-line\.anki-card-preview-cardblock\s*\{[^}]+\}/s)?.[0];
			expect(rule).toBeDefined();
			expect(rule).not.toMatch(/padding/);
			expect(rule).not.toMatch(/border-left/);
			expect(rule).not.toMatch(/margin/);
			expect(rule).not.toMatch(/background:/);
		});

		test('card envelope horizontal bleed uses one shared pixel token for paint and border', () => {
			const stylesheet = css();
			expect(stylesheet).toContain('--anki-card-preview-block-bleed-x: 8px');
			expect(stylesheet).not.toMatch(/--anki-card-preview-block-bleed-x:\s*[\d.]+em/);
			const envelopeRule = stylesheet.match(/\.anki-card-envelope\s*\{[^}]+\}/s)?.[0];
			expect(envelopeRule).toBeDefined();
			expect(envelopeRule).toMatch(/position:\s*absolute/);
			expect(envelopeRule).toMatch(/pointer-events:\s*none/);
			expect(envelopeRule).toMatch(/z-index:\s*-1/);
			expect(envelopeRule).toMatch(/border-left:\s*2px solid var\(--anki-cardblock-border-color\)/);
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

		test('card envelope layer uses background plane contract', () => {
			const stylesheet = css();
			const layerRule = stylesheet.match(/\.cm-layer-anki-envelope\s*\{[^}]+\}/)?.[0];
			expect(layerRule).toBeDefined();
			expect(layerRule).toMatch(/pointer-events:\s*none/);
			expect(layerRule).toMatch(/z-index:\s*-1/);
		});

		test('tooltip shows on actionable badge hover', () => {
			const stylesheet = css();
			expect(stylesheet).toMatch(
				/\.anki-card-preview-badge--action:hover\s+\.anki-card-preview-tooltip/,
			);
			expect(stylesheet).not.toMatch(/\.anki-card-preview-badge-more/);
		});

		test('actionable badge has button reset and pointer cursor', () => {
			const rule = css().match(/\.anki-card-preview-badge--action\s*\{[^}]+\}/)?.[0];
			expect(rule).toBeDefined();
			expect(rule).toMatch(/cursor:\s*pointer/);
			expect(rule).toMatch(/appearance:\s*none/);
			expect(rule).toMatch(/min-height:\s*unset/);
			expect(rule).not.toMatch(/font:\s*inherit/);
			expect(rule).toMatch(/font-size:\s*var\(--anki-card-preview-badge-font-size\)/);
		});

		test('badge size uses root css variables', () => {
			const stylesheet = css();
			const rootRule = stylesheet.match(/:root\s*\{[^}]+\}/)?.[0];
			expect(rootRule).toBeDefined();
			expect(rootRule).toMatch(/--anki-card-preview-badge-font-size:/);
			expect(rootRule).toMatch(/--anki-card-preview-badge-padding:/);
			expect(rootRule).toMatch(/--anki-card-preview-badge-gap:/);
			const badgeRule = stylesheet.match(/\.anki-card-preview-badge\s*\{[^}]+\}/)?.[0];
			expect(badgeRule).toBeDefined();
			expect(badgeRule).toMatch(/font-size:\s*var\(--anki-card-preview-badge-font-size\)/);
			expect(badgeRule).toMatch(/padding:\s*var\(--anki-card-preview-badge-padding\)/);
		});

		test('tooltip sizing escapes badge shrink-to-fit', () => {
			const rule = css().match(/\.anki-card-preview-tooltip\s*\{[^}]+\}/)?.[0];
			expect(rule).toBeDefined();
			expect(rule).toMatch(/width:\s*max-content/);
			expect(rule).toMatch(/white-space:\s*pre-line/);
		});
	});

	describe('embedded blocks and widgets', () => {
		const cssPath = join(import.meta.dir, '../../plugin/styles.css');
		const css = () => readFileSync(cssPath, 'utf8');

		test('embedded widgets sit on top of envelope with no slice pseudo-elements', () => {
			const stylesheet = css();
			expect(stylesheet).not.toMatch(
				/\.cm-line\.anki-card-preview-cardblock\s*\+\s*\.cm-embed-block\.cm-table-widget::before/,
			);
			expect(stylesheet).not.toMatch(
				/\.cm-line\.anki-card-preview-cardblock\s*\+\s*\.cm-embed-block\.math-block::before/,
			);
		});

		test('table widget rules do not change table layout', () => {
			const stylesheet = css();
			const tableRule = stylesheet.match(
				/\.cm-embed-block\.cm-table-widget\s*\{[^}]+\}/s,
			)?.[0];
			if (tableRule) {
				expect(tableRule).not.toMatch(/\bpadding\s*:/);
				expect(tableRule).not.toMatch(/\bmargin\s*:/);
				expect(tableRule).not.toMatch(/\bwidth\s*:/);
				expect(tableRule).not.toMatch(/\bborder(-left|-right|-top|-bottom)?\s*:/);
			}
		});

		test('cloze palette defines 5 distinct visual groups', () => {
			const stylesheet = css();
			const colorValues = new Set<string>();
			for (let i = 1; i <= 5; i++) {
				const rule = stylesheet.match(
					new RegExp(`\\.anki-card-preview-cloze-group-${i}\\s*\\{[^}]+\\}`, 's'),
				)?.[0];
				expect(rule).toBeDefined();
				const colorMatch = rule!.match(/color:\s*([^;]+);/);
				expect(colorMatch).toBeDefined();
				colorValues.add(colorMatch![1].trim().toLowerCase());
			}
			expect(colorValues.size).toBe(5);
		});
	});

	describe('card-block thematic-break handling', () => {
		const cssPath = join(import.meta.dir, '../../plugin/styles.css');
		const css = () => readFileSync(cssPath, 'utf8');

		test('thematic breaks sit on envelope layer without box-shadow slice hacks', () => {
			const stylesheet = css();
			expect(stylesheet).not.toMatch(/\.hr\.cm-line::before/);
			expect(stylesheet).not.toMatch(/\.hr\.cm-line::after/);
			expect(stylesheet).not.toMatch(/anki-card-preview-before-mid-hr[\s\S]*box-shadow/);
		});

		test('isMarkdownThematicBreakLine matches setext thematic breaks', () => {
			expect(isMarkdownThematicBreakLine('---')).toBe(true);
			expect(isMarkdownThematicBreakLine('***')).toBe(true);
			expect(isMarkdownThematicBreakLine('___')).toBe(true);
			expect(isMarkdownThematicBreakLine('  ---  ')).toBe(true);
			expect(isMarkdownThematicBreakLine('--')).toBe(false);
			expect(isMarkdownThematicBreakLine('- - -')).toBe(true);
			expect(isMarkdownThematicBreakLine('not a break')).toBe(false);
		});

		test('findBeforeMidCardHrLineStarts marks previous covered line for mid-card --- only', () => {
			const midDoc = ['#### Card', 'before', '---', 'after'].join('\n');
			const midLines = linesFromDoc(midDoc);
			const midCovered = midLines.map((line) => line.from);
			expect(findBeforeMidCardHrLineStarts(midLines, midCovered)).toEqual([
				midDoc.indexOf('before'),
			]);

			const trailingDoc = ['#### Card', 'body', '---'].join('\n');
			const trailingLines = linesFromDoc(trailingDoc);
			// Trailing --- excluded from covered offsets (stripAuthoring / contentEnd).
			const trailingCovered = trailingLines
				.filter((line) => line.text !== '---')
				.map((line) => line.from);
			expect(findBeforeMidCardHrLineStarts(trailingLines, trailingCovered)).toEqual([]);
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
