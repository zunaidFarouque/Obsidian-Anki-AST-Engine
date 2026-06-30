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

	test('heading background uses same tint source with fixed +20% opacity bump', () => {
		const cssPath = join(import.meta.dir, '../../plugin/styles.css');
		const baseRule = readFileSync(cssPath, 'utf8').match(
			/\.cm-line\.anki-card-preview-cardblock\s*\{[^}]+\}/s,
		)?.[0];
		expect(baseRule).toBeDefined();
		expect(baseRule).toMatch(
			/--anki-cardblock-heading-opacity:\s*calc\(var\(--anki-cardblock-body-opacity\) \+ 20%\)/,
		);
		expect(baseRule).toMatch(
			/--anki-cardblock-bg:\s*color-mix\([^;]*var\(--anki-cardblock-tint\)[^;]*var\(--anki-cardblock-body-opacity\)/,
		);
		expect(baseRule).toMatch(
			/--anki-cardblock-heading-bg:\s*color-mix\([^;]*var\(--anki-cardblock-tint\)[^;]*var\(--anki-cardblock-heading-opacity\)/,
		);
	});

	test('skip block uses half-opacity neutral background of sync', () => {
		const cssPath = join(import.meta.dir, '../../plugin/styles.css');
		const stylesheet = readFileSync(cssPath, 'utf8');
		const baseRule = stylesheet.match(/\.cm-line\.anki-card-preview-cardblock\s*\{[^}]+\}/s)?.[0];
		const skipRule = stylesheet.match(/anki-card-preview-cardblock--skip\s*\{[^}]+\}/s)?.[0];
		expect(baseRule).toBeDefined();
		expect(skipRule).toBeDefined();
		const syncBodyOpacity = Number(
			baseRule!.match(/--anki-cardblock-body-opacity:\s*([\d.]+)%/)?.[1],
		);
		const skipBodyOpacity = Number(
			skipRule!.match(/--anki-cardblock-body-opacity:\s*([\d.]+)%/)?.[1],
		);
		expect(skipRule).toMatch(/--anki-cardblock-tint:\s*var\(--background-modifier-hover\)/);
		expect(skipBodyOpacity).toBe(syncBodyOpacity / 2);
	});

	test('outcome variants set tint tokens only, not painted background tokens', () => {
		const cssPath = join(import.meta.dir, '../../plugin/styles.css');
		const stylesheet = readFileSync(cssPath, 'utf8');
		for (const variant of ['sync', 'warn', 'skip', 'error'] as const) {
			const rule = stylesheet.match(
				new RegExp(`anki-card-preview-cardblock--${variant}\\s*\\{[^}]+\\}`, 's'),
			)?.[0];
			expect(rule).toBeDefined();
			expect(rule).not.toMatch(/--anki-cardblock-heading-bg/);
			expect(rule).not.toMatch(/--anki-cardblock-bg:/);
		}
		expect(stylesheet).toMatch(/anki-card-preview-cardblock--warn[\s\S]*--anki-cardblock-tint/);
		expect(stylesheet).toMatch(/anki-card-preview-cardblock--skip[\s\S]*--anki-cardblock-tint/);
		expect(stylesheet).toMatch(/anki-card-preview-cardblock--error[\s\S]*--anki-cardblock-tint/);
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

		test('cardblock horizontal bleed uses one shared pixel token for paint and border', () => {
			const stylesheet = css();
			expect(stylesheet).toContain('--anki-card-preview-block-bleed-x: 8px');
			expect(stylesheet).not.toMatch(/--anki-card-preview-block-bleed-x:\s*[\d.]+em/);
			const paintBefore = stylesheet.match(
				/\.anki-card-preview-cardblock::before\s*\{[^}]+\}/s,
			)?.[0];
			expect(paintBefore).toBeDefined();
			expect(paintBefore).toMatch(/left:\s*calc\(-1 \* var\(--anki-card-preview-block-bleed-x\)\)/);
			expect(paintBefore).toMatch(/right:\s*calc\(-1 \* var\(--anki-card-preview-block-bleed-x\)\)/);
			expect(paintBefore).toMatch(/top:\s*0/);
			expect(paintBefore).toMatch(/bottom:\s*0/);
			expect(paintBefore).toMatch(/border-left:\s*2px solid var\(--anki-cardblock-border-color\)/);
			expect(stylesheet).not.toMatch(
				/\.anki-card-preview-cardblock\.anki-card-preview-delimiter-guide\s*\{[^}]*linear-gradient\(var\(--anki-cardblock-paint\)/s,
			);
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

		test('cardblock tail mask and section-start extend share horizontal bleed', () => {
			const stylesheet = css();
			expect(stylesheet).toMatch(/\.anki-card-preview-cardblock--tail[\s\S]*::after/);
			expect(stylesheet).toMatch(
				/\.anki-card-preview-cardblock--tail[\s\S]*left:\s*calc\(-1 \* var\(--anki-card-preview-block-bleed-x\)\)/,
			);
			expect(stylesheet).toMatch(
				/\.anki-card-preview-heading--section-start[\s\S]*left:\s*calc\(-1 \* var\(--anki-card-preview-block-bleed-x\)\)/,
			);
			expect(stylesheet).not.toMatch(/\.anki-card-preview-envelope/);
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
