import { describe, expect, test } from 'bun:test';
import { getBodyStartOffset } from '../../src/io/frontmatterFilter';
import { parseCardDocument } from '../../src/cardSyntax/parseCardDocument';
import { DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS, customCardType } from '../../src/cardSyntax/types';
import {
	computePreviewOutcomeClass,
	formatCardPreviewTooltip,
	frontmatterFromObsidianMetadata,
} from '../../plugin/src/cardPreviewUtils';

function parseWithSyncHeader(body: string) {
	const raw = `---
AnkiSync: on
anki_cardDefault: basic
---

${body}`;
	return parseCardDocument(raw, {
		...DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
		bodyStartOffset: getBodyStartOffset(raw),
	});
}

describe('card preview integration reconciliation', () => {
	test('subtle mode maps sync+warn cards to warn classes', () => {
		const result = parseWithSyncHeader(
			`#### Basic with literal braces

Front with {{word}} literal

:::

Back`,
		);
		const card = result.cards[0]!;
		expect(card.outcome).toBe('sync');
		expect(card.messages.some((message) => message.level === 'warn')).toBe(true);

		expect(computePreviewOutcomeClass(card, 'subtle')).toBe('warn');
	});

	test('explicit mode adds explicit output classes', () => {
		const result = parseWithSyncHeader(
			`#### Basic conflict #anki/cardType/basic

Front

:::r

Back`,
		);
		const card = result.cards[0]!;
		expect(card.outcome).toBe('error');
		expect(computePreviewOutcomeClass(card, 'explicit')).toBe('error-explicit');
	});

	test('DEL-08 emits extra delimiter marker message without hard error', () => {
		const result = parseWithSyncHeader(
			`#### Extra delimiters stay in back

Front

:::

Back line one
:::
Back line two`,
		);

		const card = result.cards[0]!;
		expect(card.outcome).toBe('sync');
		expect(card.messages.some((message) => message.ruleId === 'DEL-08')).toBe(true);
		expect(card.messages.some((message) => message.text.includes('Extra delimiter ignored'))).toBe(
			true,
		);
	});

	test('tooltip uses noteType wording for custom note types', () => {
		expect(
			formatCardPreviewTooltip({
				resolvedType: customCardType('Vocab'),
				outcome: 'sync',
				messages: [{ level: 'warn', text: 'Unknown custom field' }],
			}),
		).toBe('Type: noteType: Vocab\nSituation: warning\nWarning: Unknown custom field');
	});

	test('editor body without YAML parses as sync-eligible via externalFrontmatter', () => {
		const body = '#### A1 Basic OK\n\nFront\n\n:::\n\nBack';
		const result = parseCardDocument(body, {
			...DEFAULT_PARSE_CARD_DOCUMENT_OPTIONS,
			bodyStartOffset: 0,
			externalFrontmatter: frontmatterFromObsidianMetadata({
				AnkiSync: true,
				anki_cardDefault: 'basic',
				cardDeclarationHeadingLevel: 4,
			}),
		});

		expect(result.syncEligible).toBe(true);
		expect(result.cards.length).toBeGreaterThan(0);
	});
});
