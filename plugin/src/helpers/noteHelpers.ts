import { MarkdownView, Notice, normalizePath, TFile, type App } from 'obsidian';
import type { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import type { AnkiAstSyncSettings } from '../settings';
import {
	buildNewNoteContent,
	setTargetDeckFrontmatter,
	toggleAnkiSyncFrontmatter,
	type BuiltInCardKind,
} from './noteHelperUtils';
import { DeckSuggestModal } from '../ui/deckSuggestModal';

export async function createNewAnkiNote(
	app: App,
	settings: AnkiAstSyncSettings,
	cardType?: BuiltInCardKind,
): Promise<void> {
	try {
		let targetFolderPath = '';
		if (settings.newNoteFolder && settings.newNoteFolder.trim().length > 0) {
			targetFolderPath = normalizePath(settings.newNoteFolder.trim());
			const folderExists = app.vault.getAbstractFileByPath(targetFolderPath);
			if (!folderExists) {
				await app.vault.createFolder(targetFolderPath);
			}
		} else {
			const activeFile = app.workspace.getActiveFile();
			const parent = app.fileManager.getNewFileParent(activeFile?.path ?? '');
			targetFolderPath = parent.path === '/' ? '' : parent.path;
		}

		// Find unique filename
		const baseName = 'Untitled Anki Note';
		let fileName = `${baseName}.md`;
		let fullPath = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName;
		let counter = 1;

		while (app.vault.getAbstractFileByPath(normalizePath(fullPath))) {
			fileName = `${baseName} ${counter}.md`;
			fullPath = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName;
			counter++;
		}

		const deck = settings.newNoteDefaultDeck.trim().length > 0
			? settings.newNoteDefaultDeck.trim()
			: (settings.defaultAnkiDeck.trim().length > 0 ? settings.defaultAnkiDeck.trim() : undefined);

		const { content, cursorOffset } = buildNewNoteContent({
			deck,
			starterCard: settings.newNoteInsertStarterCard,
			cardType: cardType ?? 'basic',
			headingLevel: settings.defaultCardDeclarationHeadingLevel,
			delimiter: settings.delimiter,
		});

		const newFile = await app.vault.create(normalizePath(fullPath), content);
		if (newFile instanceof TFile) {
			const leaf = app.workspace.getLeaf(false);
			await leaf.openFile(newFile);
		}

		// Position cursor at card title
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (view && cursorOffset > 0) {
			const pos = view.editor.offsetToPos(cursorOffset);
			view.editor.setCursor(pos);
		}

		new Notice(`Created Anki note "${newFile.basename}"`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Failed to create Anki note: ${message}`, 8000);
		console.error('Failed to create Anki note:', error);
	}
}

export async function toggleAnkiSyncForActiveNote(app: App): Promise<void> {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile || activeFile.extension !== 'md') {
		new Notice('Open a Markdown note to toggle Anki sync.', 5000);
		return;
	}

	try {
		let stateReported = 'on';
		await app.fileManager.processFrontMatter(activeFile, (frontmatter: Record<string, unknown>) => {
			const { newState } = toggleAnkiSyncFrontmatter(frontmatter);
			stateReported = newState;
		});

		new Notice(
			stateReported === 'on'
				? `Anki sync enabled for "${activeFile.basename}".`
				: `Anki sync disabled for "${activeFile.basename}".`,
			5000,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Failed to update frontmatter: ${message}`, 8000);
		console.error('Failed to update frontmatter:', error);
	}
}

export async function setTargetDeckForActiveNote(
	app: App,
	clientProvider: () => AnkiConnectClient | Promise<AnkiConnectClient>,
): Promise<void> {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile || activeFile.extension !== 'md') {
		new Notice('Open a Markdown note to set target Anki deck.', 5000);
		return;
	}

	let decks: string[] = [];
	try {
		const client = await clientProvider();
		decks = await client.deckNames();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Cannot fetch decks from Anki: ${message}`, 8000);
		return;
	}

	if (decks.length === 0) {
		new Notice('No Anki decks found.', 5000);
		return;
	}

	new DeckSuggestModal(app, decks, (chosenDeck) => {
		void (async () => {
			try {
				await app.fileManager.processFrontMatter(activeFile, (frontmatter: Record<string, unknown>) => {
					setTargetDeckFrontmatter(frontmatter, chosenDeck);
				});
				new Notice(`Target deck set to "${chosenDeck}" for "${activeFile.basename}".`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				new Notice(`Failed to update deck: ${message}`, 8000);
			}
		})();
	}).open();
}
