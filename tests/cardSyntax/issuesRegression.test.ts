import { describe, expect, test } from 'bun:test';
import { parseCardDocument } from '../../src/cardSyntax/parseCardDocument';
import { compileCardField } from '../../src/ast/cardCompiler';
import { buildClozeTokenDecorations, buildHeadingBadgeModel } from '../../plugin/src/cardPreviewUtils';
import { isCardDeclarationHeadingLine } from '../../plugin/src/cardPreviewEditor';

describe('User Reported Issues Regression Suite', () => {
	test('Issue 1 (STRESS-Basic-03): Empty Back allowed with delimiter ::: compiles to sync and empty Back field', () => {
		const doc = [
			'---',
			'AnkiSync: on',
			'---',
			'',
			'#### [STRESS-Basic-03] Empty back Allowed',
			'',
			'Front text with delimiter but no Back content (STRESS-Basic-03).',
			'',
			':::',
			'',
			'<!--anki-id: f106e19d-e1db-400a-a362-a752130b962e-->',
		].join('\n');

		const result = parseCardDocument(doc);
		expect(result.syncEligible).toBe(true);
		expect(result.cards).toHaveLength(1);

		const card = result.cards[0]!;
		expect(card.outcome).toBe('sync');
		expect(card.resolvedType).toEqual({ kind: 'builtin', type: 'basic' });

		const frontHtml = compileCardField(card.frontNodes);
		const backHtml = compileCardField(card.backNodes);
		expect(frontHtml).toContain('Front text with delimiter but no Back content (STRESS-Basic-03).');
		expect(backHtml.trim()).toBe('');
	});

	test('Issue 2 (STRESS-Cloze-02): Shorthand deletion auto-numbers into {{c1::...}} in compiled Anki field', () => {
		const doc = [
			'---',
			'AnkiSync: on',
			'---',
			'',
			'### Unit #anki/cardType/cloze',
			'',
			'#### [STRESS-Cloze-02] Shorthand Deletion',
			'',
			'The {{entropy}} increases in an isolated system (STRESS-Cloze-02).',
			'',
			'<!--anki-id: 7215f2fd-4d37-4f0e-be43-6237c1314f92-->',
		].join('\n');

		const result = parseCardDocument(doc);
		expect(result.cards).toHaveLength(1);

		const card = result.cards[0]!;
		expect(card.outcome).toBe('sync');
		const frontHtml = compileCardField(card.frontNodes);
		expect(frontHtml).toContain('{{c1::entropy}}');
		expect(frontHtml).not.toContain('{{entropy}}');
	});

	test('Issue 2 (STRESS-Cloze-03): Multi-shorthand auto-groups case-insensitively into c1 and c2 in compiled Anki field', () => {
		const doc = [
			'---',
			'AnkiSync: on',
			'---',
			'',
			'### Unit #anki/cardType/cloze',
			'',
			'#### [STRESS-Cloze-03] Auto-number and Hints',
			'',
			'{{Java}} runs on a JVM. {{java}} is same group. {{Python}} is a new group.',
			'',
			'<!--anki-id: 36a03fcb-8b5e-44f2-bcb6-0c41bc12e0d1-->',
		].join('\n');

		const result = parseCardDocument(doc);
		expect(result.cards).toHaveLength(1);

		const card = result.cards[0]!;
		const frontHtml = compileCardField(card.frontNodes);
		expect(frontHtml).toContain('{{c1::Java}}');
		expect(frontHtml).toContain('{{c1::java}}');
		expect(frontHtml).toContain('{{c2::Python}}');
	});

	test('Issue 3 (STRESS-Cloze-03): Live preview attaches inferred c1 and c2 labels to shorthand tokens', () => {
		const doc = [
			'---',
			'AnkiSync: on',
			'---',
			'',
			'### Unit #anki/cardType/cloze',
			'',
			'#### [STRESS-Cloze-03] Auto-number and Hints',
			'',
			'{{Java}} runs on a JVM. {{java}} is same group. {{Python}} is a new group.',
			'',
			'<!--anki-id: 36a03fcb-8b5e-44f2-bcb6-0c41bc12e0d1-->',
		].join('\n');

		const result = parseCardDocument(doc);
		const card = result.cards[0]!;
		const decorations = buildClozeTokenDecorations(card, doc);

		expect(decorations).toHaveLength(3);
		expect(decorations[0]!.inferredLabel).toBe('c1');
		expect(decorations[0]!.paletteClass).toBe('anki-card-preview-cloze-group-1');

		expect(decorations[1]!.inferredLabel).toBe('c1');
		expect(decorations[1]!.paletteClass).toBe('anki-card-preview-cloze-group-1');

		expect(decorations[2]!.inferredLabel).toBe('c2');
		expect(decorations[2]!.paletteClass).toBe('anki-card-preview-cloze-group-2');
	});

	test('Issue 4 (STRESS-Cloze-09): Multi-cloze palette groups 1 through 5 are generated sequentially', () => {
		const doc = [
			'---',
			'AnkiSync: on',
			'---',
			'',
			'### Unit #anki/cardType/cloze',
			'',
			'#### [STRESS-Cloze-09] Multi-cloze Palette Visual Test',
			'',
			'{{c1::First}} {{c2::Second}} {{c3::Third}} {{c4::Fourth}} {{c5::Fifth}}',
		].join('\n');

		const result = parseCardDocument(doc);
		const card = result.cards[0]!;
		const decorations = buildClozeTokenDecorations(card, doc);

		expect(decorations).toHaveLength(5);
		const classes = decorations.map((d) => d.paletteClass);
		expect(classes).toEqual([
			'anki-card-preview-cloze-group-1',
			'anki-card-preview-cloze-group-2',
			'anki-card-preview-cloze-group-3',
			'anki-card-preview-cloze-group-4',
			'anki-card-preview-cloze-group-5',
		]);
	});

	test('Issue 5 (STRESS-Typed-03): Multi-answer pipes with trailing comments do not trigger multiline warning', () => {
		const doc = [
			'---',
			'AnkiSync: on',
			'---',
			'',
			'#### [STRESS-Typed-03] TYP-05 Multi-answer Pipes',
			'',
			'Name a capital of France (STRESS-Typed-03).',
			'',
			':::t',
			'',
			'Paris | Lyon | Marseille',
			'',
			'<!--anki-id: aaf8f0a1-af57-4373-8213-c6f6aa404ba6-->',
			'',
			'<!-- expect:',
			'  preview: sync — typed multi-answer',
			'-->',
		].join('\n');

		const result = parseCardDocument(doc);
		const card = result.cards[0]!;
		expect(card.outcome).toBe('sync');
		const warnMessages = card.messages.filter((m) => m.level === 'warn');
		expect(warnMessages).toHaveLength(0);

		const badge = buildHeadingBadgeModel(card);
		expect(badge.displayOutcome).toBe('sync');
		expect(badge.label).toBe('typed');
	});

	test('Issue 6 (STRESS-Typed-05): Multiline typed answer triggers TYP-04 warning badge', () => {
		const doc = [
			'---',
			'AnkiSync: on',
			'---',
			'',
			'#### [STRESS-Typed-05] Multiline Typed Answer Warn',
			'',
			'What is the capital of Germany (STRESS-Typed-05)?',
			'',
			':::t',
			'',
			'Berlin',
			'',
			'Extra explanatory line that should trigger a warning.',
			'',
			'<!--anki-id: bdc99a50-05fe-49f2-be4c-518d3dda1d38-->',
		].join('\n');

		const result = parseCardDocument(doc);
		const card = result.cards[0]!;
		const warnMessage = card.messages.find((m) => m.level === 'warn');
		expect(warnMessage).toBeDefined();
		expect(warnMessage!.ruleId).toBe('TYP-04');

		const badge = buildHeadingBadgeModel(card);
		expect(badge.displayOutcome).toBe('warn');
		expect(badge.label).toBe('typed ⚠️');
	});

	test('Issue 8 (STRESS-Sect-04): User hashtags propagate while engine cardType hashtags are separated', () => {
		const doc = [
			'---',
			'AnkiSync: on',
			'---',
			'',
			'### Unit C — Tag Separation #exam-prep #anki/cardType/cloze',
			'',
			'#### [STRESS-Sect-04] User Tag Separated from Engine Tag',
			'',
			'The {{c1::Krebs cycle}} takes place in mitochondria (STRESS-Sect-04).',
			'',
			'<!--anki-id: 7a20dabd-22e1-43c0-8217-2874986ab8bb-->',
		].join('\n');

		const result = parseCardDocument(doc);
		const card = result.cards[0]!;
		expect(card.hashtags.user).toEqual(['exam-prep']);
		expect(card.hashtags.engine).toContain('#anki/cardType/cloze');
		expect(card.resolvedType).toEqual({ kind: 'builtin', type: 'cloze' });
	});

	test('Issue 9 (STRESS-Rich-06): Bare heading without text (####) parses valid card and matches declaration level', () => {
		expect(isCardDeclarationHeadingLine('####', 4)).toBe(true);
		expect(isCardDeclarationHeadingLine('#### ', 4)).toBe(true);
		expect(isCardDeclarationHeadingLine('#####', 4)).toBe(false);

		const doc = [
			'---',
			'AnkiSync: on',
			'---',
			'',
			'####',
			'',
			'What is the powerhouse of the cell (STRESS-Rich-06 empty heading)?',
			'',
			':::',
			'',
			'Mitochondria.',
			'',
			'<!--anki-id: be06e945-8aeb-4807-8297-fd9c7ebf0921-->',
		].join('\n');

		const result = parseCardDocument(doc);
		expect(result.cards).toHaveLength(1);
		const card = result.cards[0]!;
		expect(card.outcome).toBe('sync');
		expect(card.title).toBe('');
	});
});
