import { MarkdownView, Notice, type App } from 'obsidian';
import { removeAnkiSyncComments } from './commentCleanerUtils';

export { removeAnkiSyncComments };

/**
 * Command action to remove all Anki sync comments from the active markdown note.
 * If the note is open in an active editor, updates the editor buffer (supporting Undo).
 * Otherwise, updates the file via app.vault.modify.
 */
export async function removeAnkiSyncCommentsFromActiveNote(
	app: App,
): Promise<void> {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile || activeFile.extension !== 'md') {
		new Notice('Open a markdown note to remove Anki sync comments.', 6000);
		return;
	}

	const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
	if (markdownView && markdownView.file === activeFile) {
		const editor = markdownView.editor;
		const original = editor.getValue();
		const { text, count } = removeAnkiSyncComments(original);

		if (count === 0) {
			new Notice('No Anki sync comments found in this note.', 5000);
			return;
		}

		editor.setValue(text);
		new Notice(
			`Removed ${count} Anki sync comment${count === 1 ? '' : 's'} from current note.`,
			6000,
		);
		return;
	}

	const original = await app.vault.read(activeFile);
	const { text, count } = removeAnkiSyncComments(original);

	if (count === 0) {
		new Notice('No Anki sync comments found in this note.', 5000);
		return;
	}

	await app.vault.modify(activeFile, text);
	new Notice(
		`Removed ${count} Anki sync comment${count === 1 ? '' : 's'} from "${activeFile.basename}".`,
		6000,
	);
}
