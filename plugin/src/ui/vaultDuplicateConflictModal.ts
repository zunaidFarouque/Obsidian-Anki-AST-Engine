import { App, Modal } from 'obsidian';
import type { DuplicateWarning } from 'obsidian-anki-ast-engine/sync';
import { stripHtmlForSearch } from 'obsidian-anki-ast-engine/sync';
import { openVaultCard } from '../navigation/openVaultCard';
import { basename, truncate } from './syncDisplayUtils';

type ConflictEntry = {
	file: string;
	tag: string;
	frontPreview: string;
};

function collectConflictEntries(warnings: DuplicateWarning[]): ConflictEntry[] {
	const entries: ConflictEntry[] = [];

	for (const warning of warnings) {
		const frontPreview = truncate(stripHtmlForSearch(warning.frontHtml), 120);
		for (const source of warning.sources) {
			entries.push({
				file: source.file,
				tag: source.tag,
				frontPreview,
			});
		}
	}

	return entries;
}

export class VaultDuplicateConflictModal extends Modal {
	private readonly warnings: DuplicateWarning[];
	private resolveChoice: ((proceed: boolean) => void) | undefined;

	constructor(app: App, warnings: DuplicateWarning[]) {
		super(app);
		this.warnings = warnings;
	}

	static open(app: App, warnings: DuplicateWarning[]): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new VaultDuplicateConflictModal(app, warnings);
			modal.resolveChoice = resolve;
			modal.open();
		});
	}

	onOpen(): void {
		const { contentEl, titleEl, modalEl } = this;
		modalEl.addClass('anki-ast-sync-duplicate-modal');
		titleEl.setText('Duplicate front cards in vault');
		contentEl.empty();

		contentEl.createEl('p', {
			cls: 'anki-ast-sync-duplicate-intro',
			text: 'Anki cannot create two cards with the same front in a deck. These vault cards conflict:',
		});

		const list = contentEl.createEl('ul', { cls: 'anki-ast-sync-duplicate-list' });
		for (const entry of collectConflictEntries(this.warnings)) {
			const item = list.createEl('li');
			const button = item.createEl('button', {
				cls: 'anki-ast-sync-duplicate-item',
				type: 'button',
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-front',
				text: entry.frontPreview,
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-meta',
				text: `${basename(entry.file)} · ${entry.tag}`,
			});
			button.addEventListener('click', () => {
				void openVaultCard(this.app, entry.file, entry.tag);
			});
		}

		const footer = contentEl.createDiv({ cls: 'anki-ast-sync-duplicate-footer' });
		footer
			.createEl('button', { cls: 'mod-warning', text: 'Cancel', type: 'button' })
			.addEventListener('click', () => {
				this.closeWithChoice(false);
			});
		footer
			.createEl('button', { cls: 'mod-cta', text: 'Sync anyway', type: 'button' })
			.addEventListener('click', () => {
				this.closeWithChoice(true);
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private closeWithChoice(proceed: boolean): void {
		this.resolveChoice?.(proceed);
		this.resolveChoice = undefined;
		this.close();
	}
}
