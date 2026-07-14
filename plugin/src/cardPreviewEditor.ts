import { RangeSetBuilder } from '@codemirror/state';
import type { Extension, StateField } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	type PluginValue,
	type ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import type { TFile } from 'obsidian';
import type { ParseCardDocumentResult, ResolvedCard } from 'obsidian-anki-ast-engine/cardSyntax';
import { getBodyStartOffset } from 'obsidian-anki-ast-engine/cardSyntax';
import type { AnkiAstSyncSettings } from './settings';
import {
	buildBackOnlyClozeWarningMeta,
	buildClozeTokenDecorations,
	buildDelimiterLineDecorations,
	buildHeadingBadgeModel,
	findCardHeadingLinePositions,
	findLineRangeForOffset,
	formatCardPreviewTooltip,
	shouldRebuildCardPreviewDecorations,
	type CardHeadingLinePosition,
	type DocumentLine,
} from './cardPreviewUtils';
import {
	cardFollowsSectionHeading,
	isBlankDocumentLine,
	shouldPaintInterCardTail,
} from './cardPreviewLayout';

const HEADING_OUTLINE_CLASS = 'anki-card-preview-heading';
const HEADING_SECTION_START_CLASS = 'anki-card-preview-heading--section-start';
const CARD_BLOCK_CLASS = 'anki-card-preview-cardblock';
const CARD_BLOCK_TAIL_CLASS = 'anki-card-preview-cardblock--tail';
const BADGE_CLASS = 'anki-card-preview-badge';
export const BADGE_SLOT_CLASS = 'anki-card-preview-badge-slot';
const DELIMITER_GUIDE_CLASS = 'anki-card-preview-delimiter-guide';
const DELIMITER_GUIDE_INFO_CLASS = 'anki-card-preview-delimiter-guide--info';
const DELIMITER_GUIDE_TYPED_CLASS = 'anki-card-preview-delimiter-guide--typed';
const DELIMITER_GUIDE_REVERSIBLE_CLASS = 'anki-card-preview-delimiter-guide--reversible';
const DELIMITER_EXTRA_CLASS = 'anki-card-preview-delimiter-extra';
const CLOZE_TOKEN_CLASS = 'anki-card-preview-cloze-token';

let badgeAccessibilityIdCounter = 0;

function nextBadgeAccessibilityId(prefix: string): string {
	badgeAccessibilityIdCounter += 1;
	return `${prefix}-${badgeAccessibilityIdCounter}`;
}

function buildDelimiterGuideClasses(garnishText?: string): string {
	const classes = [DELIMITER_GUIDE_CLASS];
	if (garnishText === 'ℹ') {
		classes.push(DELIMITER_GUIDE_INFO_CLASS);
	} else if (garnishText === '⌨') {
		classes.push(DELIMITER_GUIDE_TYPED_CLASS);
	} else if (garnishText === '↑↓') {
		classes.push(DELIMITER_GUIDE_REVERSIBLE_CLASS);
	}
	return classes.join(' ');
}

interface PendingDecoration {
	from: number;
	to: number;
	decoration: Decoration;
	startSide: number;
}

function buildSortedDecorationSet(entries: PendingDecoration[]): DecorationSet {
	if (entries.length === 0) {
		return Decoration.none;
	}

	entries.sort((a, b) => {
		if (a.from !== b.from) {
			return a.from - b.from;
		}
		return a.startSide - b.startSide;
	});

	const builder = new RangeSetBuilder<Decoration>();
	for (const entry of entries) {
		builder.add(entry.from, entry.to, entry.decoration);
	}
	return builder.finish();
}

class CardPreviewBadgeWidget extends WidgetType {
	constructor(
		private readonly card: ResolvedCard,
		private readonly onMoreAction?: () => void,
	) {
		super();
	}

	eq(other: CardPreviewBadgeWidget): boolean {
		return (
			other.card.outcome === this.card.outcome &&
			other.card.title === this.card.title &&
			formatCardPreviewTooltip(other.card) === formatCardPreviewTooltip(this.card)
		);
	}

	toDOM(): HTMLElement {
		return createCardPreviewBadgeElement(this.card, this.onMoreAction);
	}
}

export function createCardPreviewBadgeElement(
	card: ResolvedCard,
	onMoreAction?: () => void,
): HTMLElement {
	const slot = document.createElement('span');
	slot.className = BADGE_SLOT_CLASS;

	const badgeModel = buildHeadingBadgeModel(card);
	const tooltip = formatCardPreviewTooltip(card);
	const badge = onMoreAction
		? document.createElement('button')
		: document.createElement('span');
	const actionClass = onMoreAction ? ` ${BADGE_CLASS}--action` : '';
	badge.className = `${BADGE_CLASS} ${BADGE_CLASS}--${badgeModel.displayOutcome}${actionClass}`;
	const label = document.createElement('span');
	label.className = 'anki-card-preview-badge-label';
	label.textContent = badgeModel.label;
	const tooltipElement = document.createElement('span');
	tooltipElement.className = 'anki-card-preview-tooltip';
	tooltipElement.setAttribute('role', 'tooltip');
	tooltipElement.textContent = tooltip;
	const tooltipId = nextBadgeAccessibilityId('anki-card-preview-tooltip');
	tooltipElement.setAttribute('id', tooltipId);
	if (onMoreAction) {
		(badge as HTMLButtonElement).type = 'button';
		const labelId = nextBadgeAccessibilityId('anki-card-preview-badge-label');
		label.setAttribute('id', labelId);
		badge.setAttribute('aria-labelledby', labelId);
		badge.setAttribute('aria-describedby', tooltipId);
		badge.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			onMoreAction();
		});
	} else {
		badge.setAttribute('aria-label', tooltip);
	}
	badge.appendChild(label);
	badge.appendChild(tooltipElement);
	const backOnlyMeta = buildBackOnlyClozeWarningMeta(card);
	if (backOnlyMeta.hasBackOnlyWarning) {
		badge.dataset.backOnlyClozeWarning = backOnlyMeta.ruleId ?? 'true';
	}
	slot.appendChild(badge);
	return slot;
}

export interface CardPreviewEditorOptions {
	getSettings: () => AnkiAstSyncSettings;
	parseContent: (content: string, file?: TFile) => ParseCardDocumentResult;
	getCardDeclarationHeadingLevel: (content: string, file?: TFile) => number;
	getSettingsRevision: () => number;
	openCardPreviewDetails?: (card: ResolvedCard, filePath: string) => void;
	editorLivePreviewField?: StateField<boolean>;
	editorInfoField?: StateField<{ file: TFile | null } | undefined>;
}

function isCardDeclarationHeadingLine(line: string, headingLevel: number): boolean {
	const clampedLevel = Math.min(6, Math.max(1, headingLevel));
	const markPrefix = '#'.repeat(clampedLevel);
	const requiredPrefix = `${markPrefix} `;
	if (!line.startsWith(requiredPrefix)) {
		return false;
	}
	return !(line.length > requiredPrefix.length && line[requiredPrefix.length] === '#');
}

function mapCardsToHeadingLines(
	cards: ResolvedCard[],
	lines: DocumentLine[],
	headingLevel: number,
	fallbackHeadings: CardHeadingLinePosition[],
): Array<{ card: ResolvedCard; heading: CardHeadingLinePosition }> {
	const pairs: Array<{ card: ResolvedCard; heading: CardHeadingLinePosition }> = [];
	const usedFallbackIndices = new Set<number>();

	for (const card of cards) {
		const declarationHeading = findLineRangeForOffset(lines, card.range.start);
		if (declarationHeading) {
			const declarationLineText =
				lines.find((line) => line.from === declarationHeading.from)?.text ?? '';
			if (isCardDeclarationHeadingLine(declarationLineText, headingLevel)) {
				pairs.push({ card, heading: declarationHeading });
				continue;
			}
		}

		const fallbackIndex = fallbackHeadings.findIndex(
			(heading, index) =>
				!usedFallbackIndices.has(index) &&
				heading.from >= card.range.start,
		);
		if (fallbackIndex >= 0) {
			usedFallbackIndices.add(fallbackIndex);
			pairs.push({ card, heading: fallbackHeadings[fallbackIndex]! });
		}
	}

	return pairs;
}

function findCoveredLineStarts(
	lines: DocumentLine[],
	startOffset: number,
	endOffsetExclusive: number,
): number[] {
	const starts: number[] = [];
	for (const line of lines) {
		if (line.from < startOffset) {
			continue;
		}
		if (line.from >= endOffsetExclusive) {
			break;
		}
		starts.push(line.from);
	}
	return starts;
}

function resolveCardBlockEndOffset(
	lines: DocumentLine[],
	card: ResolvedCard,
	nextHeadingStart: number,
): number {
	const probeOffset = Math.max(card.range.start, card.range.end - 1);
	const endLine = findLineRangeForOffset(lines, probeOffset);
	if (!endLine) {
		return nextHeadingStart;
	}
	return Math.min(nextHeadingStart, endLine.to + 1);
}

function resolveLivePreviewMode(
	view: EditorView,
	livePreviewField?: StateField<boolean>,
): boolean {
	if (livePreviewField) {
		const fieldValue = view.state.field(livePreviewField, false);
		if (typeof fieldValue === 'boolean') {
			return fieldValue;
		}
	}

	const sourceView = view.dom.closest('.markdown-source-view');
	return sourceView?.classList.contains('is-live-preview') ?? false;
}

function resolveEditorFile(
	view: EditorView,
	infoField?: StateField<{ file: TFile | null } | undefined>,
): TFile | undefined {
	if (!infoField) {
		return undefined;
	}
	return view.state.field(infoField, false)?.file ?? undefined;
}

export function buildCardPreviewDecorations(
	view: EditorView,
	options: CardPreviewEditorOptions,
): DecorationSet {
	if (!options.getSettings().enableCardPreview) {
		return Decoration.none;
	}

	const isLivePreview = resolveLivePreviewMode(view, options.editorLivePreviewField);
	if (!isLivePreview) {
		return Decoration.none;
	}

	const file = resolveEditorFile(view, options.editorInfoField);

	const content = view.state.doc.toString();
	const result = options.parseContent(content, file);
	if (!result.syncEligible || result.cards.length === 0) {
		return Decoration.none;
	}

	const headingLevel = options.getCardDeclarationHeadingLevel(content, file);
	const bodyStartOffset = getBodyStartOffset(content);
	const lines = [];
	const doc = view.state.doc;

	for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
		const line = doc.line(lineNumber);
		lines.push({ from: line.from, to: line.to, text: line.text });
	}

	const headingPositions = findCardHeadingLinePositions(
		lines,
		headingLevel,
		bodyStartOffset,
	);
	const pairs = mapCardsToHeadingLines(result.cards, lines, headingLevel, headingPositions);
	const pending: PendingDecoration[] = [];
	const previewSettings = options.getSettings();
	const sectionTopExtend = previewSettings.cardPreviewSectionTopExtend ?? 0;
	const interCardGapEm = previewSettings.cardPreviewInterCardGapEm ?? 0;

	for (let index = 0; index < pairs.length; index += 1) {
		const { card, heading } = pairs[index]!;
		const badgeModel = buildHeadingBadgeModel(card);
		const nextHeadingStart = pairs[index + 1]?.heading.from ?? doc.length + 1;
		const cardBlockEndOffset = resolveCardBlockEndOffset(lines, card, nextHeadingStart);
		const coveredLineStarts = findCoveredLineStarts(lines, heading.from, cardBlockEndOffset);
		const sectionStart =
			sectionTopExtend > 0 &&
			cardFollowsSectionHeading(lines, heading.from, headingLevel);
		const nextLineAfterCard = lines.find((line) => line.from >= cardBlockEndOffset);
		const paintTail = shouldPaintInterCardTail(
			index < pairs.length - 1,
			interCardGapEm,
			nextLineAfterCard == null || isBlankDocumentLine(nextLineAfterCard.text),
		);
		const lastCoveredLineStart = coveredLineStarts[coveredLineStarts.length - 1];

		for (const lineStart of coveredLineStarts) {
			const isTail = paintTail && lineStart === lastCoveredLineStart;
			pending.push({
				from: lineStart,
				to: lineStart,
				decoration: Decoration.line({
					class: [
						`${CARD_BLOCK_CLASS} ${CARD_BLOCK_CLASS}--${badgeModel.displayOutcome}`,
						isTail ? CARD_BLOCK_TAIL_CLASS : '',
					]
						.filter(Boolean)
						.join(' '),
				}),
				startSide: 0,
			});
		}

		pending.push({
			from: heading.from,
			to: heading.from,
			decoration: Decoration.line({
				class: [
					HEADING_OUTLINE_CLASS,
					`${HEADING_OUTLINE_CLASS}--${badgeModel.displayOutcome}`,
					sectionStart ? HEADING_SECTION_START_CLASS : '',
				]
					.filter(Boolean)
					.join(' '),
			}),
			startSide: 0,
		});
		pending.push({
			from: heading.to,
			to: heading.to,
			decoration: Decoration.widget({
				widget: new CardPreviewBadgeWidget(card, () => {
					if (file?.path) {
						options.openCardPreviewDetails?.(card, file.path);
					}
				}),
				side: 1,
			}),
			startSide: 1,
		});

		for (const delimiterModel of buildDelimiterLineDecorations(card)) {
			const lineRange = findLineRangeForOffset(lines, delimiterModel.start);
			if (!lineRange) {
				continue;
			}
			if (delimiterModel.isPrimary) {
				pending.push({
					from: lineRange.from,
					to: lineRange.from,
					decoration: Decoration.line({
						class: buildDelimiterGuideClasses(delimiterModel.garnishText),
					}),
					startSide: 0,
				});
				continue;
			}

			pending.push({
				from: lineRange.from,
				to: lineRange.from,
				decoration: Decoration.line({
					class: DELIMITER_EXTRA_CLASS,
					attributes: {
						'data-delimiter-extra': delimiterModel.discouragementText ?? '',
					},
				}),
				startSide: 0,
			});
		}

		for (const token of buildClozeTokenDecorations(card, content)) {
			pending.push({
				from: token.start,
				to: token.end,
				decoration: Decoration.mark({
					class: `${CLOZE_TOKEN_CLASS} ${token.paletteClass}`,
				}),
				startSide: 0,
			});
		}
	}

	return buildSortedDecorationSet(pending);
}

class CardPreviewEditorPlugin implements PluginValue {
	decorations: DecorationSet;
	private lastSettingsRevision = -1;
	private lastLivePreview = false;
	private lastEditorFilePath: string | undefined;

	constructor(
		private readonly view: EditorView,
		private readonly options: CardPreviewEditorOptions,
	) {
		this.decorations = buildCardPreviewDecorations(view, options);
		this.lastSettingsRevision = options.getSettingsRevision();
		this.lastLivePreview = resolveLivePreviewMode(view, options.editorLivePreviewField);
		this.lastEditorFilePath = resolveEditorFile(view, options.editorInfoField)?.path;
	}

	update(update: ViewUpdate): void {
		const settingsRevision = this.options.getSettingsRevision();
		const currentLivePreview = resolveLivePreviewMode(
			update.view,
			this.options.editorLivePreviewField,
		);
		const currentEditorFilePath = resolveEditorFile(
			update.view,
			this.options.editorInfoField,
		)?.path;
		const livePreviewChanged = currentLivePreview !== this.lastLivePreview;
		const editorFileChanged = currentEditorFilePath !== this.lastEditorFilePath;

		if (
			!shouldRebuildCardPreviewDecorations({
				docChanged: update.docChanged,
				viewportChanged: update.viewportChanged,
				settingsRevision,
				lastSettingsRevision: this.lastSettingsRevision,
				livePreviewChanged,
				editorFileChanged,
			})
		) {
			return;
		}

		this.lastSettingsRevision = settingsRevision;
		this.lastLivePreview = currentLivePreview;
		this.lastEditorFilePath = currentEditorFilePath;
		this.decorations = buildCardPreviewDecorations(update.view, this.options);
	}

	destroy(): void {}
}

export function createCardPreviewEditorExtension(
	options: CardPreviewEditorOptions,
): Extension {
	return ViewPlugin.fromClass(
		class extends CardPreviewEditorPlugin {
			constructor(view: EditorView) {
				super(view, options);
			}
		},
		{
			decorations: (value) => value.decorations,
		},
	);
}
