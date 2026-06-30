import type { ResolvedCard, ResolvedCardType } from '../../src/cardSyntax/types';
import { formatProblemForHeadingContext } from './cardPreviewUtils';

export interface CardPreviewModalSection {
	title: string;
	lines: string[];
}

export function buildStructureTemplateLines(
	resolvedType: ResolvedCardType,
	customFields?: string[],
): string[] {
	if (resolvedType.kind === 'builtin') {
		switch (resolvedType.type) {
			case 'basic':
				return ['Front', ':::', 'Back'];
			case 'cloze':
				return ['Text with {{c1::...}}', ':::', 'Back Extra'];
			case 'reversible':
				return ['Question', ':::r', 'Answer'];
			case 'typed':
				return ['Question', ':::t', 'answer'];
		}
	}

	const fields = customFields?.filter(Boolean) ?? [];
	if (fields.length > 0) {
		return fields.map((field) => `::: ${field}`);
	}
	return ['::: FieldName'];
}

export function insertTemplateAfterDeclarationHeading(
	content: string,
	headingStartOffset: number,
	templateLines: string[],
): string {
	const safeHeadingStart = Math.max(0, headingStartOffset);
	const lineBreakOffset = content.indexOf('\n', safeHeadingStart);
	const insertionOffset = lineBreakOffset === -1 ? content.length : lineBreakOffset + 1;
	const templateBlock = `${templateLines.join('\n')}\n`;
	return `${content.slice(0, insertionOffset)}${templateBlock}${content.slice(insertionOffset)}`;
}

export function buildModalSections(card: ResolvedCard): CardPreviewModalSection[] {
	const problems =
		card.messages.length > 0
			? card.messages.map((message) => formatProblemForHeadingContext(message))
			: ['No problems reported'];
	return [
		{ title: 'Problems', lines: problems },
		{ title: 'Current noteType structure', lines: structureReminder(card.resolvedType) },
		{
			title: 'Create other noteTypes',
			lines: [
				':::r -> reversible',
				':::t -> typed',
				'#anki/noteType/<Name> -> custom noteType',
				'#anki/cardType/<builtin> -> built-in inheritance',
			],
		},
		{ title: 'Resolution reasoning', lines: [card.resolvedFrom] },
		{ title: 'Actions', lines: ['Insert structure template'] },
	];
}

function structureReminder(resolvedType: ResolvedCardType): string[] {
	if (resolvedType.kind === 'custom') {
		return ['Use one or more ::: FieldName blocks matching this noteType fields.'];
	}
	switch (resolvedType.type) {
		case 'basic':
			return ['Front prose -> line-start ::: -> Back prose'];
		case 'cloze':
			return ['Text with {{cN::...}} (or {{...}} shorthand), optional ::: + Back Extra'];
		case 'reversible':
			return ['Question prose -> ::: or :::r -> Answer prose'];
		case 'typed':
			return ['Question prose -> ::: or :::t -> one line plain-text answer'];
	}
}
