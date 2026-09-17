import { describe, expect, test } from 'bun:test';
import { EditorState, StateField } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
	CardEnvelopeMarker,
	calculateCardEnvelopeMarkers,
	createCardPreviewLayer,
} from '../../plugin/src/cardPreviewLayer';
import { builtinCardType, type ResolvedCard } from '../../src/cardSyntax/types';
import { parseCardDocument } from '../../src/cardSyntax/parseCardDocument';
import { getBodyStartOffset } from '../../src/io/frontmatterFilter';

function makeCard(overrides: Partial<ResolvedCard> = {}): ResolvedCard {
	return {
		title: 'Card 1',
		ordinal: 0,
		range: { start: 0, end: 30 },
		resolvedType: builtinCardType('basic'),
		resolvedFrom: 'file default',
		outcome: 'sync',
		messages: [],
		regions: {
			delimiters: [{ kind: ':::', range: { start: 15, end: 18 } }],
		},
		hashtags: { user: [], engine: [] },
		...overrides,
	};
}

class FakeDOMElement {
	className = '';
	style: Record<string, string> = {};
	dataset: Record<string, string> = {};
	constructor(public readonly tagName: string) {}
}

function withFakeDocument<T>(callback: () => T): T {
	const previous = (globalThis as { document?: unknown }).document;
	(globalThis as { document: { createElement: (tag: string) => FakeDOMElement } }).document = {
		createElement: (tag: string) => new FakeDOMElement(tag),
	};
	try {
		return callback();
	} finally {
		(globalThis as { document?: unknown }).document = previous;
	}
}

describe('CardEnvelopeMarker', () => {
	test('eq returns true when all properties match within 0.5px tolerance', () => {
		const m1 = new CardEnvelopeMarker('card-1', 'sync', 100, 200, 10, 500);
		const m2 = new CardEnvelopeMarker('card-1', 'sync', 100.2, 199.8, 10.1, 500.3);
		expect(m1.eq(m2)).toBe(true);
	});

	test('eq returns false when outcome, cardId, or dimensions differ beyond tolerance', () => {
		const base = new CardEnvelopeMarker('card-1', 'sync', 100, 200, 10, 500);
		expect(base.eq(new CardEnvelopeMarker('card-2', 'sync', 100, 200, 10, 500))).toBe(false);
		expect(base.eq(new CardEnvelopeMarker('card-1', 'warn', 100, 200, 10, 500))).toBe(false);
		expect(base.eq(new CardEnvelopeMarker('card-1', 'sync', 101, 200, 10, 500))).toBe(false);
		expect(base.eq(new CardEnvelopeMarker('card-1', 'sync', 100, 201, 10, 500))).toBe(false);
	});

	test('draw creates div element with correct class and inline coordinates', () => {
		withFakeDocument(() => {
			const marker = new CardEnvelopeMarker('card-1', 'warn', 50, 150, 8, 600);
			const dom = marker.draw();
			expect(dom.className).toBe('anki-card-envelope anki-card-envelope--warn');
			expect(dom.style.top).toBe('50px');
			expect(dom.style.height).toBe('150px');
			expect(dom.style.left).toBe('8px');
			expect(dom.style.width).toBe('600px');
		});
	});

	test('update modifies existing element in-place when dimensions change for same card and outcome', () => {
		withFakeDocument(() => {
			const initial = new CardEnvelopeMarker('card-1', 'sync', 50, 150, 8, 600);
			const dom = initial.draw();

			const next = new CardEnvelopeMarker('card-1', 'sync', 60, 160, 12, 620);
			const reused = next.update(dom as unknown as HTMLElement, initial);
			expect(reused).toBe(true);
			expect(dom.style.top).toBe('60px');
			expect(dom.style.height).toBe('160px');
			expect(dom.style.left).toBe('12px');
			expect(dom.style.width).toBe('620px');
		});
	});

	test('update returns false when cardId or outcome differ to prevent recycling/blinking', () => {
		withFakeDocument(() => {
			const initial = new CardEnvelopeMarker('card-1', 'warn', 50, 150, 8, 600);
			const dom = initial.draw();

			const differentOutcome = new CardEnvelopeMarker('card-1', 'sync', 50, 150, 8, 600);
			expect(differentOutcome.update(dom as unknown as HTMLElement, initial)).toBe(false);

			const differentCard = new CardEnvelopeMarker('card-2', 'warn', 50, 150, 8, 600);
			expect(differentCard.update(dom as unknown as HTMLElement, initial)).toBe(false);
		});
	});
});

describe('calculateCardEnvelopeMarkers', () => {
	test('returns empty array when card preview is disabled or not in live preview', () => {
		const doc = '#### Card 1\nFront\n:::\nBack\n';
		const state = EditorState.create({ doc });
		const view = { state } as unknown as EditorView;
		const options = {
			getSettings: () => ({ enableCardPreview: false } as any),
			parseContent: () => ({ syncEligible: true, cards: [makeCard()] }) as any,
			getCardDeclarationHeadingLevel: () => 4,
			getSettingsRevision: () => 0,
		};

		expect(calculateCardEnvelopeMarkers(view, options)).toEqual([]);
	});

	test('calculates single continuous envelope covering heading to content end', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const doc = ['#### Card 1', 'Front content', ':::', 'Back content'].join('\n');
		const state = EditorState.create({ doc, extensions: [livePreviewField] });
		const view = {
			state,
			scrollDOM: {
				getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
				scrollLeft: 0,
				scrollTop: 0,
				clientWidth: 800,
			},
			contentDOM: {
				getBoundingClientRect: () => ({ left: 50, top: 20, width: 700, right: 750, bottom: 500 }),
			},
			defaultLineHeight: 24,
			viewport: { from: 0, to: doc.length },
		} as unknown as EditorView;

		const card = makeCard({
			title: 'Card 1',
			range: { start: 0, end: doc.length },
			outcome: 'sync',
		});

		const markers = calculateCardEnvelopeMarkers(view, {
			getSettings: () =>
				({
					enableCardPreview: true,
					cardPreviewSectionTopExtend: 0,
					cardPreviewInterCardGapEm: 0,
				}) as any,
			parseContent: () => ({ syncEligible: true, cards: [card] }) as any,
			getCardDeclarationHeadingLevel: () => 4,
			getSettingsRevision: () => 0,
			editorLivePreviewField: livePreviewField as any,
		});

		expect(markers).toHaveLength(1);
		const marker = markers[0]!;
		expect(marker.outcome).toBe('sync');
		// left = contentLeft (50) - bleedX (8) = 42
		expect(marker.left).toBe(42);
		// width = contentWidth (700) + 2 * bleedX (16) = 716
		expect(marker.width).toBe(716);
		// height > 0
		expect(marker.height).toBeGreaterThan(0);
	});

	test('virtualization skips off-screen cards', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const doc = ['#### Card 1', 'Front', ':::', 'Back', '', '#### Card 2', 'Front 2', ':::', 'Back 2'].join('\n');
		const state = EditorState.create({ doc, extensions: [livePreviewField] });
		const card1Start = doc.indexOf('#### Card 1');
		const card2Start = doc.indexOf('#### Card 2');
		const card1End = card2Start - 1;
		const card2End = doc.length;

		const view = {
			state,
			scrollDOM: {
				getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
				scrollLeft: 0,
				scrollTop: 0,
				clientWidth: 800,
			},
			contentDOM: {
				getBoundingClientRect: () => ({ left: 50, top: 20, width: 700, right: 750, bottom: 500 }),
			},
			defaultLineHeight: 24,
			// Viewport only encompasses Card 2
			viewport: { from: card2Start, to: card2End },
		} as unknown as EditorView;

		const markers = calculateCardEnvelopeMarkers(view, {
			getSettings: () =>
				({
					enableCardPreview: true,
					cardPreviewSectionTopExtend: 0,
					cardPreviewInterCardGapEm: 0,
				}) as any,
			parseContent: () =>
				({
					syncEligible: true,
					cards: [
						makeCard({ title: 'Card 1', range: { start: card1Start, end: card1End } }),
						makeCard({ title: 'Card 2', range: { start: card2Start, end: card2End } }),
					],
				}) as any,
			getCardDeclarationHeadingLevel: () => 4,
			getSettingsRevision: () => 0,
			editorLivePreviewField: livePreviewField as any,
		});

		// Card 1 is before viewport.from, so only Card 2 is measured
		expect(markers).toHaveLength(1);
		expect(markers[0]!.cardId).toContain('Card 2');
	});

	test('trailing authoring comments stay outside envelope range', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const doc = [
			'#### Card 1',
			'Front',
			':::',
			'Back content',
			'<!--anki-id: 11111111-2222-3333-4444-555555555555-->',
			'<!-- expect: sync -->',
		].join('\n');
		const state = EditorState.create({ doc, extensions: [livePreviewField] });
		const contentEndOffset = doc.indexOf('Back content') + 'Back content'.length;

		const view = {
			state,
			scrollDOM: {
				getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
				scrollLeft: 0,
				scrollTop: 0,
				clientWidth: 800,
			},
			contentDOM: {
				getBoundingClientRect: () => ({ left: 50, top: 20, width: 700, right: 750, bottom: 500 }),
			},
			defaultLineHeight: 20,
			viewport: { from: 0, to: doc.length },
		} as unknown as EditorView;

		// Card range stops before the comments
		const card = makeCard({
			title: 'Card 1',
			range: { start: 0, end: contentEndOffset },
		});

		const markers = calculateCardEnvelopeMarkers(view, {
			getSettings: () =>
				({
					enableCardPreview: true,
					cardPreviewSectionTopExtend: 0,
					cardPreviewInterCardGapEm: 0,
				}) as any,
			parseContent: () => ({ syncEligible: true, cards: [card] }) as any,
			getCardDeclarationHeadingLevel: () => 4,
			getSettingsRevision: () => 0,
			editorLivePreviewField: livePreviewField as any,
		});

		expect(markers).toHaveLength(1);
		// With 4 content lines (####, Front, :::, Back content), height = 4 * 20 = 80
		// Total document is 6 lines (120px) — comments are excluded
		expect(markers[0]!.height).toBe(80);
	});

	test('section-start extends top upward and bottom encompasses full last line', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const doc = [
			'### Unit Section',
			'',
			'#### Card A',
			'Front A',
			'',
			'#### Card B',
			'Front B',
		].join('\n');
		const state = EditorState.create({ doc, extensions: [livePreviewField] });
		const cardAStart = doc.indexOf('#### Card A');
		const cardBStart = doc.indexOf('#### Card B');
		const cardAEnd = doc.indexOf('Front A') + 'Front A'.length;
		const cardBEnd = doc.length;

		const view = {
			state,
			scrollDOM: {
				getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
				scrollLeft: 0,
				scrollTop: 0,
				clientWidth: 800,
			},
			contentDOM: {
				getBoundingClientRect: () => ({ left: 50, top: 20, width: 700, right: 750, bottom: 500 }),
			},
			defaultLineHeight: 20,
			viewport: { from: 0, to: doc.length },
		} as unknown as EditorView;

		const markers = calculateCardEnvelopeMarkers(view, {
			getSettings: () =>
				({
					enableCardPreview: true,
					cardPreviewSectionTopExtend: 0.5,
					cardPreviewInterCardGapEm: 0.28,
				}) as any,
			parseContent: () =>
				({
					syncEligible: true,
					cards: [
						makeCard({ title: 'Card A', range: { start: cardAStart, end: cardAEnd } }),
						makeCard({ title: 'Card B', range: { start: cardBStart, end: cardBEnd } }),
					],
				}) as any,
			getCardDeclarationHeadingLevel: () => 4,
			getSettingsRevision: () => 0,
			editorLivePreviewField: livePreviewField as any,
		});

		expect(markers).toHaveLength(2);
		const markerA = markers[0]!;
		// Card A follows ### Unit Section, so sectionTopExtend (0.5 * 20 = 10px) is applied
		// docTop = 20, line 3 starts at (3 - 1) * 20 = 40, top = 20 + 40 - 10 = 50
		expect(markerA.top).toBe(50);
		// Bottom encompasses full Front A line (line 4 bottom at 80 + docTop 20 = 100)
		expect(markerA.top + markerA.height).toBe(100);
	});
});

describe('createCardPreviewLayer', () => {
	test('returns valid extension', () => {
		const extension = createCardPreviewLayer({
			getSettings: () => ({ enableCardPreview: true } as any),
			parseContent: () => ({ syncEligible: true, cards: [] }) as any,
			getCardDeclarationHeadingLevel: () => 4,
			getSettingsRevision: () => 0,
		});
		expect(extension).toBeDefined();
	});
});
