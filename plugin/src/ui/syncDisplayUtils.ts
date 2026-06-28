import type { DuplicateWarning } from 'obsidian-anki-ast-engine/sync';

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
