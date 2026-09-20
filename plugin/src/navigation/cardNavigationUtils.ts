export interface CardHeadingItem {
	line: number;
	text: string;
}

export interface EnclosingCardBounds {
	startLine: number;
	endLine: number;
	cardText: string;
}

export interface CardAnkiIdResult {
	rawId: string;
	isNumeric: boolean;
	noteId?: number;
	uuid?: string;
}

export interface ProblemCardItem {
	line: number;
	outcome: 'skip' | 'warn' | 'error';
	message: string;
}

export function isCardHeading(lineText: string, headingLevel: number): boolean {
	const prefix = '#'.repeat(headingLevel) + ' ';
	if (!lineText.startsWith(prefix)) {
		return false;
	}
	const deeperPrefix = '#'.repeat(headingLevel + 1);
	return !lineText.startsWith(deeperPrefix);
}

export function findCardHeadings(
	lines: string[],
	headingLevel: number,
): CardHeadingItem[] {
	const items: CardHeadingItem[] = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line !== undefined && isCardHeading(line, headingLevel)) {
			items.push({ line: i, text: line });
		}
	}
	return items;
}

export function findNextCardLine(
	lines: string[],
	currentLine: number,
	headingLevel: number,
	wrapAround = true,
): number | null {
	const headings = findCardHeadings(lines, headingLevel);
	if (headings.length === 0) return null;

	for (const h of headings) {
		if (h.line > currentLine) {
			return h.line;
		}
	}

	if (wrapAround) {
		const first = headings[0];
		if (first) return first.line;
	}

	return null;
}

export function findPreviousCardLine(
	lines: string[],
	currentLine: number,
	headingLevel: number,
	wrapAround = true,
): number | null {
	const headings = findCardHeadings(lines, headingLevel);
	if (headings.length === 0) return null;

	for (let i = headings.length - 1; i >= 0; i--) {
		const item = headings[i];
		if (item && item.line < currentLine) {
			return item.line;
		}
	}

	if (wrapAround) {
		const last = headings[headings.length - 1];
		if (last) return last.line;
	}

	return null;
}

export function findEnclosingCardBounds(
	lines: string[],
	currentLine: number,
	headingLevel: number,
): EnclosingCardBounds | null {
	const headings = findCardHeadings(lines, headingLevel);
	if (headings.length === 0) return null;

	let startLine = -1;
	for (let i = 0; i < headings.length; i++) {
		const item = headings[i];
		if (item && item.line <= currentLine) {
			startLine = item.line;
		} else {
			break;
		}
	}

	if (startLine === -1) {
		return null;
	}

	let endLine = lines.length - 1;
	for (let i = 0; i < headings.length; i++) {
		const item = headings[i];
		if (item && item.line > startLine) {
			endLine = item.line - 1;
			break;
		}
	}

	const cardText = lines.slice(startLine, endLine + 1).join('\n');
	return {
		startLine,
		endLine,
		cardText,
	};
}

export function extractCardAnkiId(cardText: string): CardAnkiIdResult | null {
	const match = cardText.match(/<!--\s*anki-id:\s*([^\s>]+)\s*-->/i);
	if (!match) {
		return null;
	}

	const rawId = match[1]?.trim();
	if (!rawId) {
		return null;
	}

	const isNumeric = /^\d+$/.test(rawId);
	if (isNumeric) {
		const noteId = Number(rawId);
		return {
			rawId,
			isNumeric: true,
			noteId,
		};
	}

	return {
		rawId,
		isNumeric: false,
		uuid: rawId,
	};
}

export function findProblemCards(
	cards: Array<{ line?: number; headingLine?: number; outcome: string; messages?: string[] }>,
): ProblemCardItem[] {
	const result: ProblemCardItem[] = [];

	for (const card of cards) {
		const outcome = card.outcome;
		if (outcome === 'skip' || outcome === 'warn' || outcome === 'error') {
			const line = card.line ?? card.headingLine ?? 0;
			const msg = (card.messages && card.messages.length > 0 && card.messages[0])
				? card.messages[0]
				: '';
			result.push({
				line,
				outcome,
				message: msg,
			});
		}
	}

	return result;
}

export function findNextProblemCardLine(
	problemCards: Array<{ line: number }>,
	currentLine: number,
): number | null {
	if (problemCards.length === 0) return null;

	for (const item of problemCards) {
		if (item.line > currentLine) {
			return item.line;
		}
	}

	const first = problemCards[0];
	return first ? first.line : null;
}
