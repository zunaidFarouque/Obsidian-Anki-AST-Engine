import type { Extension } from '@codemirror/state';
import {
	layer,
	type EditorView,
	type LayerMarker,
	type ViewUpdate,
	Direction,
} from '@codemirror/view';
import type { ResolvedCard, SyncOutcome } from 'obsidian-anki-ast-engine/cardSyntax';
import { getBodyStartOffset } from 'obsidian-anki-ast-engine/cardSyntax';
import type { CardPreviewEditorOptions } from './cardPreviewEditor';
import { refreshPreviewEffect } from './cardPreviewEditor';
import {
	buildHeadingBadgeModel,
	extractDocumentLines,
	findCardHeadingLinePositions,
	mapCardsToHeadingLines,
	resolveCardBlockEndOffset,
	resolveEditorFile,
	resolveLivePreviewMode,
	type CardHeadingLinePosition,
	type DocumentLine,
} from './cardPreviewUtils';
import { cardFollowsSectionHeading } from './cardPreviewLayout';

export type CardPreviewHeadingStyle = 'off' | 'shaded' | 'divided';

export class CardEnvelopeMarker implements LayerMarker {
	constructor(
		public readonly cardId: string,
		public readonly outcome: SyncOutcome,
		public readonly top: number,
		public readonly height: number,
		public readonly left: number,
		public readonly width: number,
		public readonly headingHeight: number = 0,
		public readonly headingStyle: CardPreviewHeadingStyle = 'off',
	) {}

	eq(other: LayerMarker): boolean {
		if (!(other instanceof CardEnvelopeMarker)) {
			return false;
		}
		return (
			this.cardId === other.cardId &&
			this.outcome === other.outcome &&
			this.headingStyle === other.headingStyle &&
			Math.abs(this.headingHeight - other.headingHeight) < 0.5 &&
			Math.abs(this.top - other.top) < 0.5 &&
			Math.abs(this.height - other.height) < 0.5 &&
			Math.abs(this.left - other.left) < 0.5 &&
			Math.abs(this.width - other.width) < 0.5
		);
	}

	draw(): HTMLElement {
		// eslint-disable-next-line obsidianmd/prefer-active-doc
		const doc = typeof activeDocument !== 'undefined' ? activeDocument : document;
		const elt = doc.createElement('div');
		elt.className = `anki-card-envelope anki-card-envelope--${this.outcome}`;
		if (this.headingStyle !== 'off' && this.headingHeight > 0) {
			const header = doc.createElement('div');
			header.className = `anki-card-envelope-header anki-card-envelope-header--${this.headingStyle}`;
			header.style.height = `${this.headingHeight}px`;
			elt.appendChild(header);
		}
		this.adjust(elt);
		return elt;
	}

	update(dom: HTMLElement, prev: LayerMarker): boolean {
		if (!(prev instanceof CardEnvelopeMarker)) {
			return false;
		}
		if (
			this.cardId !== prev.cardId ||
			this.outcome !== prev.outcome ||
			this.headingStyle !== prev.headingStyle
		) {
			return false;
		}
		if (this.headingStyle !== 'off' && this.headingHeight > 0) {
			const headerEl = (dom.firstElementChild ?? (dom as unknown as { children?: HTMLElement[] }).children?.[0]) as HTMLElement | null;
			if (!headerEl || !headerEl.className?.includes('anki-card-envelope-header')) {
				return false;
			}
			headerEl.style.height = `${this.headingHeight}px`;
		}
		this.adjust(dom);
		return true;
	}

	private adjust(dom: HTMLElement): void {
		dom.style.top = `${this.top}px`;
		dom.style.height = `${this.height}px`;
		dom.style.left = `${this.left}px`;
		dom.style.width = `${this.width}px`;
	}
}

function safeLineBlockAt(
	view: EditorView,
	pos: number,
): { top: number; bottom: number; height: number } {
	if (typeof view.lineBlockAt === 'function') {
		return view.lineBlockAt(pos);
	}
	const doc = view.state?.doc;
	const defaultHeight = view.defaultLineHeight || 20;
	if (doc) {
		const lineNumber = doc.lineAt(Math.min(pos, doc.length)).number;
		const top = (lineNumber - 1) * defaultHeight;
		return {
			top,
			bottom: top + defaultHeight,
			height: defaultHeight,
		};
	}
	return { top: 0, bottom: defaultHeight, height: defaultHeight };
}

interface CachedEnvelopeParse {
	file: unknown;
	settingsRevision: number;
	headingLevel: number;
	lines: DocumentLine[];
	pairs: Array<{ card: ResolvedCard; heading: CardHeadingLinePosition }>;
}

const envelopeDocParseCache = new WeakMap<object, CachedEnvelopeParse>();

export function calculateCardEnvelopeMarkers(
	view: EditorView,
	options: CardPreviewEditorOptions,
): readonly CardEnvelopeMarker[] {
	if (!options.getSettings().enableCardPreview) {
		return [];
	}

	const isLivePreview = resolveLivePreviewMode(view, options.editorLivePreviewField);
	if (!isLivePreview) {
		return [];
	}

	const docObj =
		typeof view.state?.doc === 'object' && view.state.doc !== null
			? (view.state.doc as object)
			: null;
	const file = resolveEditorFile(view, options.editorInfoField);
	const settingsRevision = options.getSettingsRevision();

	let cached = docObj ? envelopeDocParseCache.get(docObj) : undefined;
	if (
		!cached ||
		cached.file !== file ||
		cached.settingsRevision !== settingsRevision
	) {
		const content = view.state.doc.toString();
		const result = options.parseContent(content, file);
		if (!result.syncEligible || result.cards.length === 0) {
			cached = {
				file,
				settingsRevision,
				headingLevel: 0,
				lines: [],
				pairs: [],
			};
		} else {
			const headingLevel = options.getCardDeclarationHeadingLevel(content, file);
			const bodyStartOffset = getBodyStartOffset(content);
			const lines = extractDocumentLines(content);
			const headingPositions = findCardHeadingLinePositions(
				lines,
				headingLevel,
				bodyStartOffset,
			);
			const pairs = mapCardsToHeadingLines(result.cards, lines, headingLevel, headingPositions);
			cached = {
				file,
				settingsRevision,
				headingLevel,
				lines,
				pairs,
			};
		}
		if (docObj) {
			envelopeDocParseCache.set(docObj, cached);
		}
	}

	if (cached.pairs.length === 0) {
		return [];
	}

	const { headingLevel, lines, pairs } = cached;
	const doc = view.state.doc;
	const viewport = view.viewport ?? { from: 0, to: doc.length };
	const previewSettings = options.getSettings();
	const sectionTopExtend = previewSettings.cardPreviewSectionTopExtend ?? 0;
	const headingStyle = previewSettings.cardPreviewHeadingStyle ?? 'off';

	// Calculate base coordinates matching .cm-scroller plane
	const scrollDOM = view.scrollDOM;
	const scrollRect = scrollDOM?.getBoundingClientRect?.() ?? {
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		width: 0,
		height: 0,
	};
	const scaleX = view.scaleX || 1;
	const scaleY = view.scaleY || 1;
	const scrollLeft = scrollDOM?.scrollLeft ?? 0;
	const scrollTop = scrollDOM?.scrollTop ?? 0;
	const clientWidth = scrollDOM?.clientWidth ?? 0;
	const isLtr = view.textDirection === Direction.LTR;
	const baseLeft =
		(isLtr ? scrollRect.left : scrollRect.right - clientWidth * scaleX) -
		scrollLeft * scaleX;
	const baseTop = scrollRect.top - scrollTop * scaleY;

	const contentDOM = view.contentDOM;
	const contentRect = contentDOM?.getBoundingClientRect?.() ?? {
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		width: 0,
		height: 0,
	};
	const contentLeft = contentRect.left - baseLeft;
	const contentWidth = contentRect.width;
	const bleedX = 8;
	const envelopeLeft = contentLeft - bleedX;
	const envelopeWidth = contentWidth + 2 * bleedX;

	const docTop = contentRect.top - baseTop + (view.documentPadding?.top ?? 0);
	const markers: CardEnvelopeMarker[] = [];

	for (let index = 0; index < pairs.length; index += 1) {
		const { card, heading } = pairs[index]!;
		const nextHeadingStart = pairs[index + 1]?.heading.from ?? doc.length + 1;
		const cardBlockEndOffset = resolveCardBlockEndOffset(lines, card, nextHeadingStart);

		// Virtualization: skip cards entirely outside visible viewport
		if (cardBlockEndOffset < viewport.from || heading.from > viewport.to) {
			continue;
		}

		const badgeModel = buildHeadingBadgeModel(card);
		const sectionStart =
			sectionTopExtend > 0 &&
			cardFollowsSectionHeading(lines, heading.from, headingLevel);

		const startBlock = safeLineBlockAt(view, heading.from);
		const probeEnd = Math.max(heading.from, cardBlockEndOffset - 1);
		const endBlock = safeLineBlockAt(view, probeEnd);

		const topExtendPx = sectionStart
			? sectionTopExtend * (startBlock.height || view.defaultLineHeight || 20)
			: 0;

		const top = docTop + startBlock.top - topExtendPx;
		const bottom = docTop + endBlock.bottom;
		const height = Math.max(0, bottom - top);
		const headingHeight = Math.min(
			height,
			(startBlock.height || view.defaultLineHeight || 20) + topExtendPx,
		);
		const cardId = card.ankiId ?? `${card.ordinal}:${heading.from}:${card.title}`;

		markers.push(
			new CardEnvelopeMarker(
				cardId,
				badgeModel.displayOutcome,
				top,
				height,
				envelopeLeft,
				envelopeWidth,
				headingHeight,
				headingStyle,
			),
		);
	}

	return markers;
}

export function createCardPreviewLayer(options: CardPreviewEditorOptions): Extension {
	let lastSettingsRevision = options.getSettingsRevision();
	let lastLivePreview = false;
	let lastEditorFilePath: string | undefined;

	return layer({
		above: false,
		class: 'cm-layer-anki-envelope',
		update(update: ViewUpdate): boolean {
			for (const tr of update.transactions) {
				for (const effect of tr.effects) {
					if (effect.is(refreshPreviewEffect)) {
						return true;
					}
				}
			}

			const currentSettingsRevision = options.getSettingsRevision();
			const currentLivePreview = resolveLivePreviewMode(
				update.view,
				options.editorLivePreviewField,
			);
			const currentEditorFilePath = resolveEditorFile(
				update.view,
				options.editorInfoField,
			)?.path;

			const settingsChanged = currentSettingsRevision !== lastSettingsRevision;
			const livePreviewChanged = currentLivePreview !== lastLivePreview;
			const fileChanged = currentEditorFilePath !== lastEditorFilePath;

			if (settingsChanged || livePreviewChanged || fileChanged) {
				lastSettingsRevision = currentSettingsRevision;
				lastLivePreview = currentLivePreview;
				lastEditorFilePath = currentEditorFilePath;
				return true;
			}

			// If preview is disabled or not in live preview, skip viewport/geometry updates
			if (!options.getSettings().enableCardPreview || !currentLivePreview) {
				return false;
			}

			if (update.viewportChanged || update.geometryChanged) {
				return true;
			}

			return false;
		},
		markers(view: EditorView): readonly LayerMarker[] {
			return calculateCardEnvelopeMarkers(view, options);
		},
	});
}
