import { App, Modal } from 'obsidian';
import type { VaultOrphan } from 'obsidian-anki-ast-engine/sync';
import type { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import { openAnkiNote } from '../navigation/openAnkiNote';

export type VaultOrphanChoice = 'cancel' | 'suspend' | 'delete';

export class VaultOrphanModal extends Modal {
	private readonly orphans: VaultOrphan[];
	private readonly client: AnkiConnectClient | undefined;
	private resolveChoice: ((choice: VaultOrphanChoice) => void) | undefined;

	constructor(
		app: App,
		orphans: VaultOrphan[],
		client?: AnkiConnectClient,
	) {
		super(app);
		this.orphans = orphans;
		this.client = client;
	}

	static open(
		app: App,
		orphans: VaultOrphan[],
		client?: AnkiConnectClient,
	): Promise<VaultOrphanChoice> {
		return new Promise((resolve) => {
			const modal = new VaultOrphanModal(app, orphans, client);
			modal.resolveChoice = resolve;
			modal.open();
		});
	}

	onOpen(): void {
		const { contentEl, titleEl, modalEl } = this;
		modalEl.addClass('anki-ast-sync-orphan-modal');
		titleEl.setText('Orphaned Anki notes');
		contentEl.empty();

		contentEl.createEl('p', {
			cls: 'anki-ast-sync-duplicate-intro',
			text: 'These Anki notes are bound to vault UUIDs that no longer appear in the current sync scan. Choose what to do before Anki is modified:',
		});

		const list = contentEl.createEl('ul', { cls: 'anki-ast-sync-duplicate-list' });
		for (const orphan of this.orphans) {
			const item = list.createEl('li');
			const button = item.createEl('button', {
				cls: 'anki-ast-sync-duplicate-item',
				type: 'button',
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-front',
				text: `Note ${orphan.ankiNoteId} · ${orphan.uuid}`,
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-meta',
				text: orphan.deck ?? 'Unknown deck',
			});
			if (this.client) {
				button.addEventListener('click', () => {
					void openAnkiNote(this.client!, orphan.ankiNoteId);
				});
			} else {
				button.disabled = true;
			}
		}

		const footer = contentEl.createDiv({ cls: 'anki-ast-sync-duplicate-footer' });
		footer
			.createEl('button', { text: 'Cancel', type: 'button' })
			.addEventListener('click', () => {
				this.closeWithChoice('cancel');
			});
		footer
			.createEl('button', { text: 'Suspend', type: 'button' })
			.addEventListener('click', () => {
				this.closeWithChoice('suspend');
			});
		footer
			.createEl('button', { cls: 'mod-warning', text: 'Delete', type: 'button' })
			.addEventListener('click', () => {
				this.closeWithChoice('delete');
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private closeWithChoice(choice: VaultOrphanChoice): void {
		this.resolveChoice?.(choice);
		this.resolveChoice = undefined;
		this.close();
	}
}
