import {
	formatResolvedCardType,
	type CardMessage,
	type ResolvedCard,
	type ResolvedCardType,
	type SyncOutcome,
} from '../../src/cardSyntax/types';

export const CARD_PREVIEW_DEBOUNCE_MS = 400;

export const OUTCOME_BADGE_CLASS: Record<SyncOutcome, string> = {
	sync: 'sync',
	skip: 'skip',
	error: 'error',
	warn: 'warn',
};

export function hashString(content: string): string {
	let hash = 0;
	for (let index = 0; index < content.length; index += 1) {
		hash = (hash * 31 + content.charCodeAt(index)) | 0;
	}
	return (hash >>> 0).toString(36);
}

export function computeContentCacheKey(filePath: string, content: string): string {
	return `${filePath}:${content.length}:${hashString(content)}`;
}

export function outcomeToBadgeClass(outcome: SyncOutcome): string {
	return OUTCOME_BADGE_CLASS[outcome];
}

export function pickPreviewMessage(messages: CardMessage[]): string | undefined {
	const priority: CardMessage['level'][] = ['error', 'warn', 'skip', 'info'];
	for (const level of priority) {
		const message = messages.find((entry) => entry.level === level);
		if (message) {
			return message.text;
		}
	}
	return undefined;
}

export function formatCardPreviewTooltip(card: {
	resolvedType: ResolvedCardType;
	messages: CardMessage[];
}): string {
	const typeLabel = formatResolvedCardType(card.resolvedType);
	const message = pickPreviewMessage(card.messages);
	return message ? `${typeLabel} — ${message}` : typeLabel;
}

export function zipCardsToHeadings<T>(
	cards: ResolvedCard[],
	headings: T[],
): Array<{ card: ResolvedCard; heading: T }> {
	const count = Math.min(cards.length, headings.length);
	return Array.from({ length: count }, (_, index) => ({
		card: cards[index]!,
		heading: headings[index]!,
	}));
}

export function cardDeclarationHeadingSelector(level: number): string {
	const clamped = Math.min(6, Math.max(1, level));
	return `h${clamped}`;
}

export interface DocumentLine {
	from: number;
	to: number;
	text: string;
}

export interface CardHeadingLinePosition {
	from: number;
	to: number;
}

export function findCardHeadingLinePositions(
	lines: DocumentLine[],
	headingLevel: number,
	bodyStartOffset: number,
): CardHeadingLinePosition[] {
	const clampedLevel = Math.min(6, Math.max(1, headingLevel));
	const markPrefix = '#'.repeat(clampedLevel);
	const requiredPrefix = `${markPrefix} `;
	const positions: CardHeadingLinePosition[] = [];

	for (const line of lines) {
		if (line.from < bodyStartOffset) {
			continue;
		}

		if (!line.text.startsWith(requiredPrefix)) {
			continue;
		}

		if (line.text.length > requiredPrefix.length && line.text[requiredPrefix.length] === '#') {
			continue;
		}

		positions.push({ from: line.from, to: line.to });
	}

	return positions;
}
