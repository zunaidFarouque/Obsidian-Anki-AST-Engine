import { type App, type Editor } from 'obsidian';
import type { AnkiAstSyncSettings } from '../settings';
import {
	buildCardTemplate,
	buildCustomNoteTypeTemplate,
	resolveDelimiter,
	resolveHeadingLevel,
	wrapWithCloze,
	type CardTemplateKind,
} from './cardTemplateUtils';
import { CardTypeSuggestModal, type CardTypeChoice } from '../ui/cardTypeSuggestModal';
import { findEnclosingCardBounds } from '../navigation/cardNavigationUtils';

function getFileFrontmatter(app: App): Record<string, unknown> | null {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile) return null;
	const cache = app.metadataCache.getFileCache(activeFile);
	return (cache?.frontmatter as Record<string, unknown>) ?? null;
}

export function insertCardTemplate(
	app: App,
	editor: Editor,
	settings: AnkiAstSyncSettings,
	type: CardTemplateKind,
): void {
	const fm = getFileFrontmatter(app);
	const headingLevel = resolveHeadingLevel(
		fm?.cardDeclarationHeadingLevel ?? fm?.carddeclarationheadinglevel,
		settings.defaultCardDeclarationHeadingLevel,
	);
	const delimiter = resolveDelimiter(
		typeof fm?.delimiter === 'string' ? fm.delimiter : undefined,
		settings.delimiter,
	);

	const selection = editor.getSelection();
	const from = selection.length > 0 ? editor.getCursor('from') : editor.getCursor();
	const to = selection.length > 0 ? editor.getCursor('to') : editor.getCursor();

	const lineText = editor.getLine(from.line);
	const hasLeadingContent = from.line > 0 && lineText.trim().length > 0;

	const { text, placeholderSelection } = buildCardTemplate(type, {
		headingLevel,
		delimiter,
		selectedText: selection,
		hasLeadingContent,
	});

	const fromOffset = editor.posToOffset(from);
	editor.replaceRange(text, from, to);

	const startPos = editor.offsetToPos(fromOffset + placeholderSelection.startOffset);
	const endPos = editor.offsetToPos(fromOffset + placeholderSelection.endOffset);
	editor.setSelection(startPos, endPos);
}

export function insertCustomCardTemplate(
	app: App,
	editor: Editor,
	settings: AnkiAstSyncSettings,
	noteTypeName: string,
	fields: string[],
): void {
	const fm = getFileFrontmatter(app);
	const headingLevel = resolveHeadingLevel(
		fm?.cardDeclarationHeadingLevel ?? fm?.carddeclarationheadinglevel,
		settings.defaultCardDeclarationHeadingLevel,
	);

	const cursor = editor.getCursor();
	const lineText = editor.getLine(cursor.line);
	const hasLeadingContent = cursor.line > 0 && lineText.trim().length > 0;

	const { text, placeholderSelection } = buildCustomNoteTypeTemplate({
		noteTypeName,
		fields,
		headingLevel,
		hasLeadingContent,
	});

	const fromOffset = editor.posToOffset(cursor);
	editor.replaceRange(text, cursor);

	const startPos = editor.offsetToPos(fromOffset + placeholderSelection.startOffset);
	const endPos = editor.offsetToPos(fromOffset + placeholderSelection.endOffset);
	editor.setSelection(startPos, endPos);
}

export function openCardTemplatePicker(
	app: App,
	editor: Editor,
	settings: AnkiAstSyncSettings,
	customNoteTypes?: Record<string, string[]>,
): void {
	new CardTypeSuggestModal(app, customNoteTypes, (choice: CardTypeChoice) => {
		if (choice.kind === 'built-in') {
			insertCardTemplate(app, editor, settings, choice.type);
		} else {
			insertCustomCardTemplate(app, editor, settings, choice.type, choice.fields);
		}
	}).open();
}

export function wrapSelectionWithCloze(
	app: App,
	editor: Editor,
	settings: AnkiAstSyncSettings,
): void {
	const selection = editor.getSelection();
	const fm = getFileFrontmatter(app);
	const headingLevel = resolveHeadingLevel(
		fm?.cardDeclarationHeadingLevel ?? fm?.carddeclarationheadinglevel,
		settings.defaultCardDeclarationHeadingLevel,
	);

	let enclosingCardText = '';
	if (settings.clozeAutoIncrement) {
		const lines = editor.getValue().split('\n');
		const cur = editor.getCursor();
		const bounds = findEnclosingCardBounds(lines, cur.line, headingLevel);
		if (bounds) {
			enclosingCardText = bounds.cardText;
		}
	}

	const { replacement, cursorOffset } = wrapWithCloze({
		selectedText: selection,
		enclosingCardText,
		shorthand: settings.clozeDefaultToShorthand,
	});

	if (selection.length > 0) {
		editor.replaceSelection(replacement);
	} else {
		const cur = editor.getCursor();
		const startOffset = editor.posToOffset(cur);
		editor.replaceRange(replacement, cur);
		const targetPos = editor.offsetToPos(startOffset + cursorOffset);
		editor.setCursor(targetPos);
	}
}
