import { describe, expect, test } from 'bun:test';
import { EditorState, StateField } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import {
	buildCardPreviewDecorations,
	createCardPreviewBadgeElement,
} from '../../plugin/src/cardPreviewEditor';
import { builtinCardType, type ResolvedCard } from '../../src/cardSyntax/types';
import { parseCardDocument } from '../../src/cardSyntax/parseCardDocument';
import { getBodyStartOffset } from '../../src/io/frontmatterFilter';
import { loadCardSyntaxStressTest } from '../../src/cardSyntax/loadFixture';

function makeCard(overrides: Partial<ResolvedCard> = {}): ResolvedCard {
	return {
		title: 'A1 Basic OK',
		ordinal: 0,
		range: { start: 0, end: 10 },
		resolvedType: builtinCardType('basic'),
		resolvedFrom: 'file default',
		outcome: 'sync',
		messages: [],
		regions: {
			delimiters: [{ kind: ':::', range: { start: 18, end: 21 } }],
		},
		hashtags: { user: [], engine: [] },
		...overrides,
	};
}

class FakeElement {
	className = '';
	textContent: string | null = null;
	type = '';
	dataset: Record<string, string> = {};
	private attributes = new Map<string, string>();
	private children: FakeElement[] = [];
	private listeners = new Map<string, Array<(event: any) => void>>();

	constructor(public readonly tagName: string) {}

	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
	}

	getAttribute(name: string): string | null {
		return this.attributes.get(name) ?? null;
	}

	hasAttribute(name: string): boolean {
		return this.attributes.has(name);
	}

	appendChild(child: FakeElement): void {
		this.children.push(child);
	}

	addEventListener(type: string, handler: (event: any) => void): void {
		const handlers = this.listeners.get(type) ?? [];
		handlers.push(handler);
		this.listeners.set(type, handlers);
	}

	dispatch(type: string): void {
		const handlers = this.listeners.get(type) ?? [];
		for (const handler of handlers) {
			handler({ preventDefault() {}, stopPropagation() {} });
		}
	}

	querySelector(selector: string): FakeElement | null {
		if (selector === 'button') {
			return this.children.find((child) => child.tagName === 'button') ?? null;
		}
		if (selector === '.anki-card-preview-tooltip') {
			return (
				this.children.find((child) =>
					(child.className ?? '').split(/\s+/).includes('anki-card-preview-tooltip'),
				) ?? null
			);
		}
		if (selector === '.anki-card-preview-badge-label') {
			return (
				this.children.find((child) =>
					(child.className ?? '').split(/\s+/).includes('anki-card-preview-badge-label'),
				) ?? null
			);
		}
		return null;
	}

	getChildren(): FakeElement[] {
		return [...this.children];
	}
}

function withFakeDocument<T>(callback: () => T): T {
	const previous = (globalThis as { document?: unknown }).document;
	(globalThis as { document: { createElement: (tag: string) => FakeElement } }).document = {
		createElement: (tag: string) => new FakeElement(tag),
	};
	try {
		return callback();
	} finally {
		(globalThis as { document?: unknown }).document = previous;
	}
}

describe('card preview editor decorations (Live Preview)', () => {
	function collectDecorations(
		decorations: ReturnType<typeof buildCardPreviewDecorations>,
		docLength: number,
	): Array<{ from: number; to: number; value: any }> {
		const entries: Array<{ from: number; to: number; value: any }> = [];
		decorations.between(0, docLength, (from, to, value) => {
			entries.push({ from, to, value });
		});
		return entries;
	}

	test('badge element wraps chip in zero-width overlay slot', () => {
		withFakeDocument(() => {
			const slot = createCardPreviewBadgeElement(makeCard());
			expect(slot.className).toContain('anki-card-preview-badge-slot');
			const badge = slot.getChildren()[0];
			expect(badge?.className).toContain('anki-card-preview-badge');
			expect(badge?.className).not.toContain('anki-card-preview-badge-slot');
		});
	});

	test('badge element omits native title tooltip while preserving aria-label', () => {
		withFakeDocument(() => {
			const slot = createCardPreviewBadgeElement(makeCard());
			const badge = slot.getChildren()[0]!;
			expect(badge.hasAttribute('title')).toBe(false);
			expect(badge.getAttribute('aria-label')).toBe('Type: basic');
			for (const child of badge.getChildren()) {
				expect(child.hasAttribute('title')).toBe(false);
			}
		});
	});

	test('actionable badge uses aria-describedby instead of descriptive aria-label', () => {
		withFakeDocument(() => {
			const slot = createCardPreviewBadgeElement(makeCard(), () => {});
			const badge = slot.getChildren()[0]!;
			expect(badge.hasAttribute('aria-label')).toBe(false);
			const tooltip = badge.querySelector('.anki-card-preview-tooltip');
			const describedBy = badge.getAttribute('aria-describedby');
			expect(describedBy).not.toBeNull();
			expect(tooltip?.getAttribute('id')).toBe(describedBy);
			expect(tooltip?.textContent).toBe('Type: basic');
			const label = badge.querySelector('.anki-card-preview-badge-label');
			expect(badge.getAttribute('aria-labelledby')).toBe(label?.getAttribute('id'));
		});
	});

	test('badge element wraps label in dedicated label span before tooltip', () => {
		withFakeDocument(() => {
			const slot = createCardPreviewBadgeElement(
				makeCard({
					messages: [{ level: 'warn', text: 'warn but still sync' }],
				}),
				() => {},
			);
			const badge = slot.getChildren()[0]!;
			const label = badge.querySelector('.anki-card-preview-badge-label');
			expect(label).not.toBeNull();
			expect(label?.textContent).toBe('basic ⚠️');
			const tooltip = badge.querySelector('.anki-card-preview-tooltip');
			expect(tooltip).not.toBeNull();
			const children = badge.getChildren();
			const labelIndex = children.findIndex((child) =>
				(child.className ?? '').includes('anki-card-preview-badge-label'),
			);
			const tooltipIndex = children.findIndex((child) =>
				(child.className ?? '').includes('anki-card-preview-tooltip'),
			);
			expect(labelIndex).toBeGreaterThanOrEqual(0);
			expect(tooltipIndex).toBeGreaterThan(labelIndex);
		});
	});

	test('returns no decorations when card preview is disabled', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const doc = '#### A1 Basic OK\n\nFront\n\n:::\n\nBack\n';
		const state = EditorState.create({ doc, extensions: [livePreviewField] });
		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: false } as any),
				parseContent: () =>
					({
						syncEligible: true,
						cards: [makeCard()],
						messages: [],
					}) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
			},
		);
		let count = 0;
		decorations.between(0, state.doc.length, () => {
			count += 1;
		});
		expect(count).toBe(0);
	});

	test('badge with action renders as single button control', () => {
		withFakeDocument(() => {
			const slot = createCardPreviewBadgeElement(
				makeCard({
					messages: [{ level: 'warn', text: 'warn but still sync' }],
				}),
				() => {},
			);
			const badge = slot.getChildren()[0]!;
			expect(badge.tagName).toBe('button');
			expect(badge.type).toBe('button');
			expect(badge.className).toContain('anki-card-preview-badge--action');
			expect(badge.querySelector('button')).toBeNull();
			const label = badge.querySelector('.anki-card-preview-badge-label');
			expect(label?.textContent).toBe('basic ⚠️');
			expect(badge.querySelector('.anki-card-preview-tooltip')).not.toBeNull();
		});
	});

	test('badge button click dispatches onMoreAction', () => {
		withFakeDocument(() => {
			let clicked = false;
			const slot = createCardPreviewBadgeElement(makeCard(), () => {
				clicked = true;
			});
			const badge = slot.getChildren()[0]!;
			expect(badge.tagName).toBe('button');
			badge.dispatch('click');
			expect(clicked).toBe(true);
		});
	});

	test('badge without action renders as non-interactive span', () => {
		withFakeDocument(() => {
			const slot = createCardPreviewBadgeElement(makeCard());
			const badge = slot.getChildren()[0]!;
			expect(badge.tagName).toBe('span');
			expect(badge.className).not.toContain('anki-card-preview-badge--action');
		});
	});

	test('badge element includes custom tooltip node', () => {
		withFakeDocument(() => {
			const slot = createCardPreviewBadgeElement(makeCard());
			const badge = slot.getChildren()[0]!;
			const tooltip = badge.querySelector('.anki-card-preview-tooltip');
			expect(tooltip).not.toBeNull();
			expect(tooltip?.textContent).toContain('basic');
		});
	});

	test('builds non-empty decorations when Live Preview is on', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});

		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/card.md' } }),
			update: (value) => value,
		});

		const doc = '#### A1 Basic OK\n\nFront\n\n:::\n\nBack\n';
		const state = EditorState.create({
			doc,
			extensions: [livePreviewField, infoField],
		});

		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () =>
					({
						syncEligible: true,
						cards: [makeCard()],
						messages: [],
					}) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);

		let count = 0;
		decorations.between(0, state.doc.length, () => {
			count += 1;
		});
		expect(count).toBeGreaterThan(0);
	});

	test('falls back to DOM live-preview class when Obsidian fields are missing', () => {
		const doc = '#### A1 Basic OK\n\nFront\n\n:::\n\nBack\n';
		const state = EditorState.create({ doc });
		const cmEditor = {
			closest: (selector: string) =>
				selector === '.markdown-source-view'
					? {
							classList: {
								contains: (className: string) => className === 'is-live-preview',
							},
						}
					: null,
		};

		const decorations = buildCardPreviewDecorations(
			{ state, dom: cmEditor } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () => ({ syncEligible: true, cards: [makeCard()], messages: [] }) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
			},
		);

		let count = 0;
		decorations.between(0, state.doc.length, () => {
			count += 1;
		});
		expect(count).toBeGreaterThan(0);
	});

	test('builds decorations for stress-test fixture without throwing', async () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});

		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/card-stress.md' } }),
			update: (value) => value,
		});

		const doc = await loadCardSyntaxStressTest();
		const state = EditorState.create({
			doc,
			extensions: [livePreviewField, infoField],
		});

		const cmEditor = {
			closest: (selector: string) =>
				selector === '.markdown-source-view'
					? {
							classList: {
								contains: (className: string) => className === 'is-live-preview',
							},
						}
					: null,
		};

		const decorations = buildCardPreviewDecorations(
			{ state, dom: cmEditor } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: (content: string) =>
					parseCardDocument(content, {
						bodyStartOffset: getBodyStartOffset(content),
					}),
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);

		let count = 0;
		decorations.between(0, state.doc.length, () => {
			count += 1;
		});

		expect(count).toBeGreaterThan(0);
	});

	test('excludes trailing expect html comments from card block tint', async () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/card-stress.md' } }),
			update: (value) => value,
		});
		const rawDoc = await loadCardSyntaxStressTest();
		const doc = rawDoc.replace(/\r\n/g, '\n');
		const state = EditorState.create({
			doc,
			extensions: [livePreviewField, infoField],
		});
		const result = parseCardDocument(doc, {
			bodyStartOffset: getBodyStartOffset(doc),
		});
		const a1 = result.cards.find((card) => card.title.startsWith('A1'))!;
		const contentEndLine = state.doc.lineAt(Math.max(a1.range.start, a1.range.end - 1));
		const expectLine = state.doc.lineAt(
			doc.indexOf('<!-- expect: sync; rules: BAS-01,BAS-02,FM-02'),
		);

		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () => result,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);

		const blockLineStarts = new Set(
			collectDecorations(decorations, state.doc.length)
				.filter((entry) =>
					String(entry.value.spec?.class ?? '').includes('anki-card-preview-cardblock'),
				)
				.map((entry) => entry.from),
		);

		expect(blockLineStarts.has(contentEndLine.from)).toBe(true);
		expect(blockLineStarts.has(expectLine.from)).toBe(false);
	});

	test('applies heading outcome classes across many cards in stress fixture', async () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/card-stress.md' } }),
			update: (value) => value,
		});
		const doc = await loadCardSyntaxStressTest();
		const state = EditorState.create({
			doc,
			extensions: [livePreviewField, infoField],
		});

		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: (content: string) =>
					parseCardDocument(content, {
						bodyStartOffset: getBodyStartOffset(content),
					}),
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);

		const entries = collectDecorations(decorations, state.doc.length);
		const headingClassEntries = entries
			.map((entry) => String(entry.value.spec?.class ?? ''))
			.filter((className) => className.includes('anki-card-preview-heading--'));
		expect(headingClassEntries.length).toBeGreaterThan(20);
		expect(headingClassEntries.some((className) => className.includes('--skip'))).toBe(true);
		expect(headingClassEntries.some((className) => className.includes('--warn'))).toBe(true);
	});

	test('applies card-block classes to heading and body lines', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/block.md' } }),
			update: (value) => value,
		});
		const doc = ['#### Card A', '', 'Front A', '', ':::', '', 'Back A', '', '#### Card B', '', 'Front B'].join(
			'\n',
		);
		const state = EditorState.create({ doc, extensions: [livePreviewField, infoField] });
		const cardAStart = doc.indexOf('#### Card A');
		const cardBStart = doc.indexOf('#### Card B');
		const cardAEnd = doc.indexOf('Back A') + 'Back A'.length;
		const cardBEnd = doc.length;

		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () =>
					({
						syncEligible: true,
						cards: [
							makeCard({ title: 'Card A', range: { start: cardAStart, end: cardAEnd } }),
							makeCard({
								title: 'Card B',
								range: { start: cardBStart, end: cardBEnd },
								outcome: 'warn',
								messages: [{ level: 'warn', text: 'warn', ruleId: 'X' }],
							}),
						],
						messages: [],
					}) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);

		const entries = collectDecorations(decorations, state.doc.length);
		const blockEntries = entries.filter((entry) =>
			String(entry.value.spec?.class ?? '').includes('anki-card-preview-cardblock'),
		);
		expect(blockEntries.length).toBeGreaterThan(3);
		const blockLines = blockEntries.map((entry) => state.doc.lineAt(entry.from).text);
		expect(blockLines).toContain('#### Card A');
		expect(blockLines).toContain('Front A');
		expect(blockLines).toContain('Back A');
	});

	test('places cloze info marker near delimiter line center', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/cloze.md' } }),
			update: (value) => value,
		});
		const doc = ['#### Cloze Card', '', 'The {{c1::term}} is present.', '', ':::', '', 'Back extra'].join('\n');
		const delimiterStart = doc.indexOf(':::');
		const state = EditorState.create({ doc, extensions: [livePreviewField, infoField] });

		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () =>
					({
						syncEligible: true,
						cards: [
							makeCard({
								range: { start: 0, end: 12 },
								resolvedType: builtinCardType('cloze'),
								regions: {
									text: { start: doc.indexOf('The'), end: doc.indexOf(':::' ) - 2 },
									delimiters: [{ kind: ':::', range: { start: delimiterStart, end: delimiterStart + 3 } }],
								},
							}),
						],
						messages: [],
					}) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);

		const entries = collectDecorations(decorations, state.doc.length);
		const infoGuideEntry = entries.find((entry) =>
			String(entry.value.spec?.class ?? '').includes('anki-card-preview-delimiter-guide--info'),
		);
		expect(infoGuideEntry).toBeDefined();
		const delimiterLine = state.doc.lineAt(delimiterStart + 1);
		expect(infoGuideEntry?.from).toBe(delimiterLine.from);
		const garnishWidgetEntry = entries.find((entry) =>
			String(entry.value.spec?.widget?.className ?? '').includes('anki-card-preview-delimiter-garnish'),
		);
		expect(garnishWidgetEntry).toBeUndefined();
	});

	test('uses centered guide modifier classes for typed and reversible garnishes', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/typed.md' } }),
			update: (value) => value,
		});
		const typedDoc = ['#### Typed Card', '', 'Question?', '', ':::t', '', 'answer'].join('\n');
		const typedDelimiterStart = typedDoc.indexOf(':::t');
		const typedState = EditorState.create({ doc: typedDoc, extensions: [livePreviewField, infoField] });
		const typedDecorations = buildCardPreviewDecorations(
			{ state: typedState } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () =>
					({
						syncEligible: true,
						cards: [
							makeCard({
								range: { start: 0, end: 12 },
								resolvedType: builtinCardType('typed'),
								regions: {
									delimiters: [
										{
											kind: ':::t',
											range: { start: typedDelimiterStart, end: typedDelimiterStart + 4 },
										},
									],
								},
							}),
						],
						messages: [],
					}) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);
		const typedEntries = collectDecorations(typedDecorations, typedState.doc.length);
		expect(
			typedEntries.some((entry) =>
				String(entry.value.spec?.class ?? '').includes('anki-card-preview-delimiter-guide--typed'),
			),
		).toBe(true);
		expect(
			typedEntries.some((entry) =>
				String(entry.value.spec?.widget?.className ?? '').includes('anki-card-preview-delimiter-garnish'),
			),
		).toBe(false);

		const reversibleDoc = ['#### Reversible Card', '', 'Q', '', ':::r', '', 'A'].join('\n');
		const reversibleDelimiterStart = reversibleDoc.indexOf(':::r');
		const reversibleState = EditorState.create({
			doc: reversibleDoc,
			extensions: [livePreviewField, infoField],
		});
		const reversibleDecorations = buildCardPreviewDecorations(
			{ state: reversibleState } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () =>
					({
						syncEligible: true,
						cards: [
							makeCard({
								range: { start: 0, end: 12 },
								resolvedType: builtinCardType('reversible'),
								regions: {
									delimiters: [
										{
											kind: ':::r',
											range: {
												start: reversibleDelimiterStart,
												end: reversibleDelimiterStart + 4,
											},
										},
									],
								},
							}),
						],
						messages: [],
					}) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);
		const reversibleEntries = collectDecorations(reversibleDecorations, reversibleState.doc.length);
		expect(
			reversibleEntries.some((entry) =>
				String(entry.value.spec?.class ?? '').includes(
					'anki-card-preview-delimiter-guide--reversible',
				),
			),
		).toBe(true);
	});

	test('marks section-start headings and tail trim between adjacent cards', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/section.md' } }),
			update: (value) => value,
		});
		const doc = ['### Subsection A0', '', '#### Card A', 'Front A', '', '#### Card B', 'Front B'].join(
			'\n',
		);
		const state = EditorState.create({ doc, extensions: [livePreviewField, infoField] });
		const cardAStart = doc.indexOf('#### Card A');
		const cardBStart = doc.indexOf('#### Card B');
		const frontAStart = doc.indexOf('Front A');
		const frontAEnd = frontAStart + 'Front A'.length;
		const blankBeforeCardA = state.doc.lineAt(cardAStart).number - 1;
		const blankBeforeCardB = state.doc.lineAt(cardBStart).number - 1;

		const editorOptions = {
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
						makeCard({ title: 'Card A', range: { start: cardAStart, end: frontAEnd } }),
						makeCard({ title: 'Card B', range: { start: cardBStart, end: cardBStart + 8 } }),
					],
					messages: [],
				}) as any,
			getCardDeclarationHeadingLevel: () => 4,
			getSettingsRevision: () => 0,
			editorLivePreviewField: livePreviewField as any,
			editorInfoField: infoField as any,
		};

		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			editorOptions,
		);

		const entries = collectDecorations(decorations, state.doc.length);
		const blockLineStarts = new Set(
			entries
				.filter((entry) =>
					String(entry.value.spec?.class ?? '').includes('anki-card-preview-cardblock'),
				)
				.map((entry) => entry.from),
		);
		const gapLineStarts = new Set(
			entries
				.filter((entry) =>
					String(entry.value.spec?.class ?? '').includes('anki-card-preview-inter-card-gap'),
				)
				.map((entry) => entry.from),
		);
		const tailLineStarts = new Set(
			entries
				.filter((entry) =>
					String(entry.value.spec?.class ?? '').includes('anki-card-preview-cardblock--tail'),
				)
				.map((entry) => entry.from),
		);
		const headingLineEntries = entries.filter(
			(entry) =>
				entry.from === cardAStart &&
				entry.value.spec?.class !== undefined,
		);
		const headingClasses = headingLineEntries
			.map((entry) => String(entry.value.spec?.class ?? ''))
			.join(' ');

		expect(blockLineStarts.has(state.doc.line(blankBeforeCardA).from)).toBe(false);
		expect(blockLineStarts.has(state.doc.line(blankBeforeCardB).from)).toBe(false);
		expect(gapLineStarts.size).toBe(0);
		expect(tailLineStarts.size).toBe(1);
		expect(tailLineStarts.has(frontAStart)).toBe(true);
		expect(headingClasses).toContain('anki-card-preview-heading--section-start');
		expect(headingClasses).toContain('anki-card-preview-cardblock');
		expect(headingLineEntries.length).toBeGreaterThanOrEqual(2);
	});

	test('keeps a visual gap between adjacent card blocks when trailing lines are outside card range', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/gap.md' } }),
			update: (value) => value,
		});
		const doc = [
			'#### Card A',
			'',
			'Front A',
			'',
			':::',
			'',
			'Back A',
			'',
			'<!-- extra comment line outside card range -->',
			'',
			'#### Card B',
			'',
			'Front B',
		].join('\n');
		const state = EditorState.create({ doc, extensions: [livePreviewField, infoField] });
		const cardAStart = doc.indexOf('#### Card A');
		const backAEnd = doc.indexOf('Back A') + 'Back A'.length;
		const cardBStart = doc.indexOf('#### Card B');

		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () =>
					({
						syncEligible: true,
						cards: [
							makeCard({ title: 'Card A', range: { start: cardAStart, end: backAEnd } }),
							makeCard({ title: 'Card B', range: { start: cardBStart, end: cardBStart + 10 } }),
						],
						messages: [],
					}) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);

		const entries = collectDecorations(decorations, state.doc.length);
		const blockLineStarts = new Set(
			entries
				.filter((entry) =>
					String(entry.value.spec?.class ?? '').includes('anki-card-preview-cardblock'),
				)
				.map((entry) => entry.from),
		);
		const outsideLine = state.doc.lineAt(doc.indexOf('<!-- extra comment line outside card range -->'));
		expect(blockLineStarts.has(outsideLine.from)).toBe(false);
	});

	test('anchors badges using card declaration offsets instead of naive heading order', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/drift.md' } }),
			update: (value) => value,
		});
		const doc = [
			'#### Not a card heading',
			'',
			'paragraph',
			'',
			'#### Actual Card A',
			'',
			'Front A',
			'',
			':::',
			'',
			'Back A',
			'',
			'#### Actual Card B',
			'',
			'Front B',
			'',
			':::',
			'',
			'Back B',
			'',
		].join('\n');
		const state = EditorState.create({
			doc,
			extensions: [livePreviewField, infoField],
		});
		const actualA = doc.indexOf('#### Actual Card A');
		const actualB = doc.indexOf('#### Actual Card B');
		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () =>
					({
						syncEligible: true,
						cards: [
							makeCard({ title: 'Actual Card A', range: { start: actualA, end: actualA + 16 } }),
							makeCard({ title: 'Actual Card B', range: { start: actualB, end: actualB + 16 } }),
						],
						messages: [],
					}) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);

		const entries = collectDecorations(decorations, state.doc.length);
		const badgeEntries = entries.filter((entry) => Boolean(entry.value.spec?.widget));
		expect(badgeEntries).toHaveLength(2);
		const badgeLines = badgeEntries.map((entry) => state.doc.lineAt(entry.from).text);
		expect(badgeLines).toContain('#### Actual Card A');
		expect(badgeLines).toContain('#### Actual Card B');
		expect(badgeLines).not.toContain('#### Not a card heading');
	});

	test('places badge widgets at declaration heading line end', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/single.md' } }),
			update: (value) => value,
		});
		const doc = '#### A1 Basic OK\n\nFront\n\n:::\n\nBack\n';
		const state = EditorState.create({
			doc,
			extensions: [livePreviewField, infoField],
		});
		const start = doc.indexOf('#### A1 Basic OK');
		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () =>
					({
						syncEligible: true,
						cards: [makeCard({ range: { start, end: start + 15 } })],
						messages: [],
					}) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);

		const entries = collectDecorations(decorations, state.doc.length);
		const badgeEntry = entries.find((entry) => Boolean(entry.value.spec?.widget));
		expect(badgeEntry).toBeDefined();
		const headingLine = state.doc.lineAt(start + 2);
		expect(badgeEntry?.from).toBe(headingLine.to);
		withFakeDocument(() => {
			const badgeDom = badgeEntry?.value.spec?.widget?.toDOM?.() as FakeElement | undefined;
			expect(badgeDom?.className ?? '').toContain('anki-card-preview-badge-slot');
		});
	});

	test('extra delimiter uses line attribute overlay instead of inline widget', () => {
		const livePreviewField = StateField.define<boolean>({
			create: () => true,
			update: (value) => value,
		});
		const infoField = StateField.define<{ file: { path: string } | null } | undefined>({
			create: () => ({ file: { path: 'Notes/extra-delim.md' } }),
			update: (value) => value,
		});
		const doc = ['#### Card', '', 'Front', '', ':::', '', 'Back', '', ':::'].join('\n');
		const state = EditorState.create({ doc, extensions: [livePreviewField, infoField] });
		const firstDelimiter = doc.indexOf(':::');
		const secondDelimiter = doc.lastIndexOf(':::');
		const cardStart = doc.indexOf('#### Card');

		const decorations = buildCardPreviewDecorations(
			{ state } as unknown as EditorView,
			{
				getSettings: () => ({ enableCardPreview: true } as any),
				parseContent: () =>
					({
						syncEligible: true,
						cards: [
							makeCard({
								range: { start: cardStart, end: cardStart + 8 },
								regions: {
									delimiters: [
										{ kind: ':::', range: { start: firstDelimiter, end: firstDelimiter + 3 } },
										{ kind: ':::', range: { start: secondDelimiter, end: secondDelimiter + 3 } },
									],
								},
							}),
						],
						messages: [],
					}) as any,
				getCardDeclarationHeadingLevel: () => 4,
				getSettingsRevision: () => 0,
				editorLivePreviewField: livePreviewField as any,
				editorInfoField: infoField as any,
			},
		);

		const entries = collectDecorations(decorations, state.doc.length);
		const extraLineEntry = entries.find((entry) =>
			String(entry.value.spec?.class ?? '').includes('anki-card-preview-delimiter-extra'),
		);
		expect(extraLineEntry).toBeDefined();
		expect(extraLineEntry?.from).toBe(state.doc.lineAt(secondDelimiter).from);
		expect(extraLineEntry?.value.spec?.attributes?.['data-delimiter-extra']).toContain(
			'Extra delimiter ignored',
		);
		const extraWidgetEntry = entries.find(
			(entry) =>
				entry.from === state.doc.lineAt(secondDelimiter).to &&
				String(entry.value.spec?.class ?? '').includes('anki-card-preview-delimiter-extra'),
		);
		expect(extraWidgetEntry).toBeUndefined();
		const delimiterExtraWidgets = entries.filter((entry) => {
			const widgetClass = String(entry.value.spec?.widget?.className ?? '');
			return widgetClass.includes('anki-card-preview-delimiter-extra');
		});
		expect(delimiterExtraWidgets).toHaveLength(0);
	});
});

