import { RangeSetBuilder } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	type PluginValue,
	type ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import { editorInfoField, editorLivePreviewField } from 'obsidian';
import type { ParseCardDocumentResult, ResolvedCard } from 'obsidian-anki-ast-engine/cardSyntax';
import { getBodyStartOffset } from 'obsidian-anki-ast-engine/cardSyntax';
import type { AnkiAstSyncSettings } from './settings';
import {
	findCardHeadingLinePositions,
	formatCardPreviewTooltip,
	outcomeToBadgeClass,
	zipCardsToHeadings,
} from './cardPreviewUtils';

const HEADING_OUTLINE_CLASS = 'anki-card-preview-heading';
const BADGE_CLASS = 'anki-card-preview-badge';

class CardPreviewBadgeWidget extends WidgetType {
	constructor(private readonly card: ResolvedCard) {
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
		const outcomeClass = outcomeToBadgeClass(this.card.outcome);
		const badge = document.createElement('span');
		badge.className = `${BADGE_CLASS} ${BADGE_CLASS}--${outcomeClass}`;
		badge.textContent = this.card.outcome;
		const tooltip = formatCardPreviewTooltip(this.card);
		badge.setAttribute('aria-label', tooltip);
		badge.title = tooltip;
		return badge;
	}
}

export interface CardPreviewEditorOptions {
	getSettings: () => AnkiAstSyncSettings;
	parseContent: (content: string) => ParseCardDocumentResult;
	getSettingsRevision: () => number;
}

export function buildCardPreviewDecorations(
	view: EditorView,
	options: CardPreviewEditorOptions,
): DecorationSet {
	if (!options.getSettings().enableCardPreview) {
		return Decoration.none;
	}

	if (!view.state.field(editorLivePreviewField)) {
		return Decoration.none;
	}

	const editorInfo = view.state.field(editorInfoField);
	if (!editorInfo?.file) {
		return Decoration.none;
	}

	const content = view.state.doc.toString();
	const result = options.parseContent(content);
	if (!result.syncEligible || result.cards.length === 0) {
		return Decoration.none;
	}

	const headingLevel = options.getSettings().defaultCardDeclarationHeadingLevel;
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
	const pairs = zipCardsToHeadings(result.cards, headingPositions);
	const builder = new RangeSetBuilder<Decoration>();

	for (const { card, heading } of pairs) {
		const outcomeClass = outcomeToBadgeClass(card.outcome);
		builder.add(
			heading.from,
			heading.from,
			Decoration.line({
				class: `${HEADING_OUTLINE_CLASS} ${HEADING_OUTLINE_CLASS}--${outcomeClass}`,
			}),
		);
		builder.add(
			heading.to,
			heading.to,
			Decoration.widget({
				widget: new CardPreviewBadgeWidget(card),
				side: 1,
			}),
		);
	}

	return builder.finish();
}

class CardPreviewEditorPlugin implements PluginValue {
	decorations: DecorationSet;
	private lastSettingsRevision = -1;

	constructor(
		private readonly view: EditorView,
		private readonly options: CardPreviewEditorOptions,
	) {
		this.decorations = buildCardPreviewDecorations(view, options);
		this.lastSettingsRevision = options.getSettingsRevision();
	}

	update(update: ViewUpdate): void {
		const settingsRevision = this.options.getSettingsRevision();
		if (
			!update.docChanged &&
			!update.viewportChanged &&
			settingsRevision === this.lastSettingsRevision
		) {
			return;
		}

		this.lastSettingsRevision = settingsRevision;
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
