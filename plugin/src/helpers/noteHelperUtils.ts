export type BuiltInCardKind = 'basic' | 'cloze' | 'reversible' | 'typed';

export interface NewNoteContentOptions {
	deck?: string;
	starterCard?: boolean;
	cardType?: BuiltInCardKind;
	headingLevel?: number;
	delimiter?: string;
}

export interface NewNoteContentResult {
	content: string;
	cursorOffset: number;
}

export function buildNewNoteContent(options: NewNoteContentOptions = {}): NewNoteContentResult {
	const starterCard = options.starterCard ?? true;
	const headingLevel = Math.max(1, Math.min(6, options.headingLevel ?? 4));
	const delimiter = options.delimiter ?? ':::';
	const cardType = options.cardType ?? 'basic';

	const frontmatterLines: string[] = ['---', 'AnkiSync: on'];
	if (options.deck && options.deck.trim().length > 0) {
		const escapedDeck = options.deck.replace(/"/g, '\\"');
		frontmatterLines.push(`target_anki_deck: "${escapedDeck}"`);
	}
	frontmatterLines.push('---', '');

	const frontmatterText = frontmatterLines.join('\n') + '\n';

	if (!starterCard) {
		return {
			content: frontmatterText,
			cursorOffset: frontmatterText.length,
		};
	}

	const hashes = '#'.repeat(headingLevel);
	let cardBody = '';
	let titleOffsetInCard = 0;

	switch (cardType) {
		case 'cloze':
			cardBody = `${hashes} Cloze Card\nThe {{c1::cloze deletion}} goes here.\n${delimiter}\nBack extra\n`;
			titleOffsetInCard = hashes.length + 1; // Start of "Cloze Card"
			break;
		case 'reversible':
			cardBody = `${hashes} Term\nFront\n:::r\nBack\n`;
			titleOffsetInCard = hashes.length + 1; // Start of "Term"
			break;
		case 'typed':
			cardBody = `${hashes} Prompt\nQuestion\n:::t\nAnswer\n`;
			titleOffsetInCard = hashes.length + 1; // Start of "Prompt"
			break;
		case 'basic':
		default:
			cardBody = `${hashes} Card Title\nFront text\n${delimiter}\nBack text\n`;
			titleOffsetInCard = hashes.length + 1; // Start of "Card Title"
			break;
	}

	const content = frontmatterText + cardBody;
	const cursorOffset = frontmatterText.length + titleOffsetInCard;

	return {
		content,
		cursorOffset,
	};
}

export function getFrontmatterSyncState(
	frontmatter: Record<string, unknown> | null | undefined,
): 'on' | 'off' | 'missing' {
	if (!frontmatter || typeof frontmatter !== 'object') {
		return 'missing';
	}

	let syncValue: unknown = undefined;
	for (const [key, value] of Object.entries(frontmatter)) {
		if (key.toLowerCase() === 'ankisync') {
			syncValue = value;
			break;
		}
	}

	if (syncValue === undefined || syncValue === null) {
		return 'missing';
	}

	if (typeof syncValue === 'boolean') {
		return syncValue ? 'on' : 'off';
	}

	if (typeof syncValue === 'string' || typeof syncValue === 'number') {
		const str = String(syncValue).trim().toLowerCase();
		if (str === 'on' || str === 'true' || str === 'yes' || str === '1') {
			return 'on';
		}
		if (str === 'off' || str === 'false' || str === 'no' || str === '0') {
			return 'off';
		}
	}

	return 'missing';
}

export function toggleAnkiSyncFrontmatter(
	frontmatter: Record<string, unknown>,
): { updated: Record<string, unknown>; newState: 'on' | 'off' } {
	const current = getFrontmatterSyncState(frontmatter);
	const newState: 'on' | 'off' = current === 'on' ? 'off' : 'on';

	const updated: Record<string, unknown> = { ...frontmatter };

	// Clean up any case variants
	for (const key of Object.keys(updated)) {
		if (key.toLowerCase() === 'ankisync') {
			delete updated[key];
		}
	}

	updated.AnkiSync = newState;
	return { updated, newState };
}

export function setTargetDeckFrontmatter(
	frontmatter: Record<string, unknown>,
	deck: string,
): Record<string, unknown> {
	const updated: Record<string, unknown> = { ...frontmatter };

	// Clean up any case variants
	for (const key of Object.keys(updated)) {
		if (key.toLowerCase() === 'target_anki_deck') {
			delete updated[key];
		}
	}

	updated.target_anki_deck = deck;
	return updated;
}
