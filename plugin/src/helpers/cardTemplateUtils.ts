export type CardTemplateKind = 'basic' | 'reversible' | 'typed' | 'cloze';

export interface CardTemplateOptions {
	headingLevel?: number;
	delimiter?: string;
	title?: string;
	selectedText?: string;
	hasLeadingContent?: boolean;
}

export interface CardTemplateResult {
	text: string;
	placeholderSelection: {
		startOffset: number;
		endOffset: number;
	};
}

export interface CustomCardTemplateOptions {
	noteTypeName: string;
	fields?: string[];
	headingLevel?: number;
	title?: string;
	hasLeadingContent?: boolean;
}

export interface WrapClozeOptions {
	selectedText?: string;
	enclosingCardText?: string;
	existingIndexes?: number[];
	shorthand?: boolean;
}

export interface WrapClozeResult {
	replacement: string;
	clozeIndex: number;
	cursorOffset: number;
}

export function resolveHeadingLevel(
	frontmatterLevel: unknown,
	fallbackLevel = 4,
): number {
	if (typeof frontmatterLevel === 'number') {
		if (Number.isInteger(frontmatterLevel) && frontmatterLevel >= 1 && frontmatterLevel <= 6) {
			return frontmatterLevel;
		}
	} else if (typeof frontmatterLevel === 'string') {
		const parsed = Number.parseInt(frontmatterLevel.trim(), 10);
		if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 6) {
			return parsed;
		}
	}

	const safeFallback = Number.isInteger(fallbackLevel) && fallbackLevel >= 1 && fallbackLevel <= 6
		? fallbackLevel
		: 4;
	return safeFallback;
}

export function resolveDelimiter(
	frontmatterDelimiter?: string | null,
	fallbackDelimiter = ':::',
): string {
	if (frontmatterDelimiter && frontmatterDelimiter.trim().length > 0) {
		return frontmatterDelimiter.trim();
	}
	return fallbackDelimiter.trim().length > 0 ? fallbackDelimiter.trim() : ':::';
}

export function buildCardTemplate(
	type: CardTemplateKind,
	options: CardTemplateOptions = {},
): CardTemplateResult {
	const headingLevel = resolveHeadingLevel(options.headingLevel, 4);
	const delimiter = resolveDelimiter(options.delimiter, ':::');
	const hashes = '#'.repeat(headingLevel);
	const prefix = options.hasLeadingContent ? '\n\n' : '';

	let defaultTitle = 'Card Title';
	let body = '';

	switch (type) {
		case 'reversible': {
			defaultTitle = options.title ?? 'Term';
			const front = options.selectedText && options.selectedText.trim().length > 0
				? options.selectedText.trim()
				: 'Front';
			body = `${hashes} ${defaultTitle}\n${front}\n:::r\nBack\n`;
			break;
		}
		case 'typed': {
			defaultTitle = options.title ?? 'Prompt';
			const question = options.selectedText && options.selectedText.trim().length > 0
				? options.selectedText.trim()
				: 'Question';
			body = `${hashes} ${defaultTitle}\n${question}\n:::t\nAnswer\n`;
			break;
		}
		case 'cloze': {
			defaultTitle = options.title ?? 'Cloze Note';
			const clozeContent = options.selectedText && options.selectedText.trim().length > 0
				? `{{c1::${options.selectedText.trim()}}}`
				: 'The {{c1::cloze deletion}} goes here.';
			body = `${hashes} ${defaultTitle}\n${clozeContent}\n:::\nOptional back extra\n`;
			break;
		}
		case 'basic':
		default: {
			defaultTitle = options.title ?? 'Card Title';
			const front = options.selectedText && options.selectedText.trim().length > 0
				? options.selectedText.trim()
				: 'Front text';
			body = `${hashes} ${defaultTitle}\n${front}\n${delimiter}\nBack text\n`;
			break;
		}
	}

	const fullText = prefix + body;
	const titleStartOffset = prefix.length + hashes.length + 1;
	const titleEndOffset = titleStartOffset + defaultTitle.length;

	return {
		text: fullText,
		placeholderSelection: {
			startOffset: titleStartOffset,
			endOffset: titleEndOffset,
		},
	};
}

export function buildCustomNoteTypeTemplate(
	options: CustomCardTemplateOptions,
): CardTemplateResult {
	const headingLevel = resolveHeadingLevel(options.headingLevel, 4);
	const hashes = '#'.repeat(headingLevel);
	const prefix = options.hasLeadingContent ? '\n\n' : '';

	const rawName = options.noteTypeName.trim();
	const sanitizedTagPart = rawName.replace(/\s+/g, '-');
	const defaultTitle = options.title ?? `${rawName} Item`;

	const fields = (options.fields && options.fields.length > 0)
		? options.fields
		: ['Front', 'Back'];

	const lines: string[] = [
		`${hashes} ${defaultTitle} #anki/noteType/${sanitizedTagPart}`,
	];

	for (const field of fields) {
		lines.push(`::: ${field.trim()}`, '');
	}

	const fullText = prefix + lines.join('\n') + '\n';
	const titleStartOffset = prefix.length + hashes.length + 1;
	const titleEndOffset = titleStartOffset + defaultTitle.length;

	return {
		text: fullText,
		placeholderSelection: {
			startOffset: titleStartOffset,
			endOffset: titleEndOffset,
		},
	};
}

export function findExistingClozeIndexes(text: string): number[] {
	if (!text) return [];

	const regex = /\{\{c(\d+)::/gi;
	const indexes = new Set<number>();
	let match: RegExpExecArray | null;

	while ((match = regex.exec(text)) !== null) {
		const group = match[1];
		if (group) {
			const num = Number.parseInt(group, 10);
			if (!Number.isNaN(num) && num > 0) {
				indexes.add(num);
			}
		}
	}

	return Array.from(indexes).sort((a, b) => a - b);
}

export function wrapWithCloze(options: WrapClozeOptions = {}): WrapClozeResult {
	const existing = options.existingIndexes ?? (
		options.enclosingCardText ? findExistingClozeIndexes(options.enclosingCardText) : []
	);

	const nextIndex = existing.length > 0 ? Math.max(...existing) + 1 : 1;

	if (options.shorthand) {
		const text = options.selectedText ?? '';
		const replacement = `{{${text}}}`;
		return {
			replacement,
			clozeIndex: nextIndex,
			cursorOffset: replacement.length,
		};
	}

	if (!options.selectedText || options.selectedText.length === 0) {
		const prefix = `{{c${nextIndex}::`;
		const suffix = '}}';
		const replacement = `${prefix}${suffix}`;
		return {
			replacement,
			clozeIndex: nextIndex,
			cursorOffset: prefix.length,
		};
	}

	const replacement = `{{c${nextIndex}::${options.selectedText}}}`;
	return {
		replacement,
		clozeIndex: nextIndex,
		cursorOffset: replacement.length,
	};
}
