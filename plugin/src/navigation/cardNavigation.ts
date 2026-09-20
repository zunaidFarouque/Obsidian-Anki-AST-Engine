import { Notice, type App, type Editor } from 'obsidian';
import type { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import { parseCardDocument } from 'obsidian-anki-ast-engine/cardSyntax';
import type { AnkiAstSyncSettings } from '../settings';
import {
	extractCardAnkiId,
	findEnclosingCardBounds,
	findNextCardLine,
	findNextProblemCardLine,
	findPreviousCardLine,
	findProblemCards,
} from './cardNavigationUtils';
import { resolveHeadingLevel } from '../helpers/cardTemplateUtils';
import { openAnkiNote } from './openAnkiNote';

function getHeadingLevel(app: App, settings: AnkiAstSyncSettings): number {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile) return settings.defaultCardDeclarationHeadingLevel;
	const cache = app.metadataCache.getFileCache(activeFile);
	const fm = cache?.frontmatter;
	return resolveHeadingLevel(
		fm?.cardDeclarationHeadingLevel ?? fm?.carddeclarationheadinglevel,
		settings.defaultCardDeclarationHeadingLevel,
	);
}

export function jumpToNextCard(
	app: App,
	editor: Editor,
	settings: AnkiAstSyncSettings,
): void {
	const headingLevel = getHeadingLevel(app, settings);
	const lines = editor.getValue().split('\n');
	const cur = editor.getCursor();

	const targetLine = findNextCardLine(lines, cur.line, headingLevel, true);
	if (targetLine === null) {
		new Notice('No card headings found in this note.', 4000);
		return;
	}

	editor.setCursor({ line: targetLine, ch: 0 });
	editor.scrollIntoView({ from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } }, true);
}

export function jumpToPreviousCard(
	app: App,
	editor: Editor,
	settings: AnkiAstSyncSettings,
): void {
	const headingLevel = getHeadingLevel(app, settings);
	const lines = editor.getValue().split('\n');
	const cur = editor.getCursor();

	const targetLine = findPreviousCardLine(lines, cur.line, headingLevel, true);
	if (targetLine === null) {
		new Notice('No card headings found in this note.', 4000);
		return;
	}

	editor.setCursor({ line: targetLine, ch: 0 });
	editor.scrollIntoView({ from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } }, true);
}

export function jumpToNextProblemCard(
	app: App,
	editor: Editor,
	settings: AnkiAstSyncSettings,
): void {
	const docText = editor.getValue();
	const activeFile = app.workspace.getActiveFile();
	const cache = activeFile ? app.metadataCache.getFileCache(activeFile) : null;
	const fm = cache?.frontmatter;

	const headingLevel = resolveHeadingLevel(
		fm?.cardDeclarationHeadingLevel ?? fm?.carddeclarationheadinglevel,
		settings.defaultCardDeclarationHeadingLevel,
	);

	try {
		const parsed = parseCardDocument(docText, {
			delimiter: settings.delimiter,
			cardDeclarationHeadingLevel: headingLevel,
			inferClozeFromManualSyntaxOnBasic: settings.inferClozeFromManualSyntaxOnBasic,
			noteTypeFieldNamesByNoteType: {},
			customLayoutMap: settings.customLayoutMap,
		});

		const rawCards = parsed.cards.map((c) => {
			const line = c.range.startLine !== undefined
				? Math.max(0, c.range.startLine - 1)
				: editor.offsetToPos(c.range.start).line;
			const messages = c.messages.map((m) => m.text);
			return {
				line,
				outcome: c.outcome,
				messages,
			};
		});

		const problemCards = findProblemCards(rawCards);
		if (problemCards.length === 0) {
			new Notice('All cards in this note are valid! No sync issues found.', 4000);
			return;
		}

		const cur = editor.getCursor();
		const targetLine = findNextProblemCardLine(problemCards, cur.line);
		if (targetLine === null) return;

		const problem = problemCards.find((p) => p.line === targetLine);
		editor.setCursor({ line: targetLine, ch: 0 });
		editor.scrollIntoView({ from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } }, true);

		const label = problem?.outcome ? problem.outcome.toUpperCase() : 'ISSUE';
		const desc = problem?.message || 'Card has syntax or delimiter issues';
		new Notice(`[${label}] ${desc}`, 6000);
	} catch (error) {
		console.warn('Failed to parse note cards for problem navigation:', error);
	}
}

export async function openActiveCardInAnki(
	app: App,
	editor: Editor,
	settings: AnkiAstSyncSettings,
	clientProvider: () => AnkiConnectClient | Promise<AnkiConnectClient>,
): Promise<void> {
	const headingLevel = getHeadingLevel(app, settings);
	const lines = editor.getValue().split('\n');
	const cur = editor.getCursor();

	const bounds = findEnclosingCardBounds(lines, cur.line, headingLevel);
	if (!bounds) {
		new Notice('Place your Cursor inside an Anki card first.', 4000);
		return;
	}

	const ankiId = extractCardAnkiId(bounds.cardText);
	if (!ankiId) {
		new Notice('This card has not been synced to Anki yet (no Anki-id comment found).', 5000);
		return;
	}

	const client = await clientProvider();

	try {
		if (ankiId.isNumeric && ankiId.noteId !== undefined) {
			await openAnkiNote(client, ankiId.noteId);
			new Notice(`Opened note #${ankiId.noteId} in Anki.`);
			return;
		}

		if (ankiId.uuid) {
			const prefix = settings.syncTagPrefix || 'obsidian-id';
			const query = `tag:${prefix}:${ankiId.uuid}`;
			let noteIds = await client.invoke<number[]>('findNotes', { query });

			if (noteIds.length === 0) {
				// Fallback search with wildcard
				noteIds = await client.invoke<number[]>('findNotes', { query: `tag:*${ankiId.uuid}*` });
			}

			const targetNoteId = noteIds[0];
			if (targetNoteId !== undefined) {
				await openAnkiNote(client, targetNoteId);
				new Notice(`Opened card in Anki (${ankiId.uuid.slice(0, 8)}...).`);
			} else {
				new Notice(`Card with ID ${ankiId.uuid.slice(0, 8)}... not found in Anki. Try syncing first.`, 6000);
			}
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Anki error: ${message}`, 8000);
		console.error('Failed to open card in Anki:', error);
	}
}
