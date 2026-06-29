import type { DuplicateWarning } from 'obsidian-anki-ast-engine/sync';

function stripHtmlToPlainText(html: string): string {
	return html
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

export function basename(filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/');
	return normalized.split('/').pop() ?? filePath;
}

export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength - 1)}…`;
}

export function duplicateWarningLabel(warning: DuplicateWarning): string {
	if (warning.kind === 'back_mismatch') {
		return 'Duplicate front with different backs';
	}
	if (warning.kind === 'vault_front_collision') {
		return 'Duplicate front collision';
	}
	return 'Anki duplicate recovered';
}

type OrphanDisplayLike = {
	ankiNoteId: number;
	uuid: string;
	deck?: string;
	preview?: string;
	frontPreview?: string;
	frontText?: string;
	front?: string;
	questionPreview?: string;
	question?: string;
	frontHtml?: string;
};

function cleanPreview(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	const cleaned = stripHtmlToPlainText(value);
	return cleaned.length > 0 ? cleaned : undefined;
}

export function formatOrphanFrontPreview(orphan: OrphanDisplayLike): string {
	const preview =
		cleanPreview(orphan.preview) ??
		cleanPreview(orphan.frontPreview) ??
		cleanPreview(orphan.frontText) ??
		cleanPreview(orphan.front) ??
		cleanPreview(orphan.questionPreview) ??
		cleanPreview(orphan.question) ??
		cleanPreview(orphan.frontHtml);
	if (preview) {
		return truncate(preview, 120);
	}

	return `Orphaned note ${orphan.ankiNoteId}`;
}

export function formatOrphanDeckMeta(orphan: Pick<OrphanDisplayLike, 'deck'>): string {
	const deck = orphan.deck?.trim();
	return deck && deck.length > 0 ? deck : 'Deck unknown';
}

export function formatOrphanUuidHint(orphan: Pick<OrphanDisplayLike, 'uuid'>): string {
	return `UUID: ${orphan.uuid}`;
}
