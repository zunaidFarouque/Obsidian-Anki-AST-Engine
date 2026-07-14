import type { AnkiAstSyncSettings } from './settings';

export const CARD_PREVIEW_INTER_CARD_GAP_VAR = '--anki-card-preview-inter-card-gap';
export const CARD_PREVIEW_SECTION_TOP_EXTEND_VAR = '--anki-card-preview-section-top-extend';

export function parseMarkdownHeadingLevel(line: string): number | null {
	const match = line.match(/^(#{1,6})\s+/);
	return match ? match[1]!.length : null;
}

function priorNonBlankLine(
	lines: { from: number; text: string }[],
	headingIndex: number,
): { from: number; text: string } | undefined {
	for (let index = headingIndex - 1; index >= 0; index -= 1) {
		if (lines[index]!.text.trim() !== '') {
			return lines[index];
		}
	}
	return undefined;
}

export function cardFollowsSectionHeading(
	lines: { from: number; text: string }[],
	headingFrom: number,
	cardDeclarationHeadingLevel: number,
): boolean {
	const headingIndex = lines.findIndex((line) => line.from === headingFrom);
	if (headingIndex <= 0) {
		return false;
	}

	const priorLine = priorNonBlankLine(lines, headingIndex);
	if (!priorLine) {
		return false;
	}

	const priorHeadingLevel = parseMarkdownHeadingLevel(priorLine.text);
	return priorHeadingLevel !== null && priorHeadingLevel < cardDeclarationHeadingLevel;
}

/**
 * Inter-card gap mask (::after on last card line) must only paint into empty space.
 * If authoring (`<!--anki-id-->`, etc.) sits on the immediate next line, the opaque
 * primary mask overlaps and half-hides that line (debug H10).
 */
export function shouldPaintInterCardTail(
	hasFollowingCard: boolean,
	interCardGapEm: number,
	nextLineIsBlank = true,
): boolean {
	return (
		hasFollowingCard &&
		Number.isFinite(interCardGapEm) &&
		interCardGapEm > 0 &&
		nextLineIsBlank
	);
}

export function isBlankDocumentLine(text: string): boolean {
	return text.trim().length === 0;
}

/** CommonMark thematic break: --- / *** / ___ (spaces between markers allowed). */
export function isMarkdownThematicBreakLine(text: string): boolean {
	return /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text);
}

/**
 * Mid-card `---` stays in covered offsets; trailing separators are excluded by
 * contentEnd / stripAuthoring. Mark the previous covered line so CSS can paint
 * `.hr.cm-line` via adjacent sibling without `:has()`.
 */
export function findBeforeMidCardHrLineStarts(
	lines: { from: number; text: string }[],
	coveredLineStarts: number[],
): number[] {
	const lineByFrom = new Map(lines.map((line) => [line.from, line] as const));
	const marked = new Set<number>();
	for (let index = 1; index < coveredLineStarts.length; index += 1) {
		const hrFrom = coveredLineStarts[index]!;
		const hrLine = lineByFrom.get(hrFrom);
		if (!hrLine || !isMarkdownThematicBreakLine(hrLine.text)) {
			continue;
		}
		marked.add(coveredLineStarts[index - 1]!);
	}
	return [...marked];
}

export function formatCardPreviewInterCardGap(settings: AnkiAstSyncSettings): string {
	const gap = settings.cardPreviewInterCardGapEm;
	const normalized = Number.isFinite(gap) && gap >= 0 ? gap : 0;
	return `${normalized}em`;
}

export function formatCardPreviewSectionTopExtend(settings: AnkiAstSyncSettings): string {
	const ratio = settings.cardPreviewSectionTopExtend;
	const normalized = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
	if (normalized <= 0) {
		return '0px';
	}
	return `calc(${normalized} * 1lh)`;
}

export function applyCardPreviewLayoutCssVariables(settings: AnkiAstSyncSettings): void {
	const root = document.documentElement;
	root.style.setProperty(CARD_PREVIEW_INTER_CARD_GAP_VAR, formatCardPreviewInterCardGap(settings));
	root.style.setProperty(
		CARD_PREVIEW_SECTION_TOP_EXTEND_VAR,
		formatCardPreviewSectionTopExtend(settings),
	);
}
