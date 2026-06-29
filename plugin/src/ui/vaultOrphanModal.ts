import { App, Modal } from 'obsidian';
import type { VaultOrphan } from 'obsidian-anki-ast-engine/sync';
import type { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import { openAnkiNote } from '../navigation/openAnkiNote';
import {
	formatOrphanDeckMeta,
	formatOrphanFrontPreview,
	formatOrphanUuidHint,
} from './syncDisplayUtils';

export type VaultOrphanChoice = 'cancel' | 'ignore' | 'delete' | 'suspend';

export type VaultOrphanModalOptions = {
	allowSuspend: boolean;
	ignoreTag: string;
};

export class VaultOrphanModal extends Modal {
	private readonly orphans: VaultOrphan[];
	private readonly client: AnkiConnectClient | undefined;
	private readonly options: VaultOrphanModalOptions;
	private resolveChoice: ((choice: VaultOrphanChoice) => void) | undefined;

	constructor(
		app: App,
		orphans: VaultOrphan[],
		modalOptions: VaultOrphanModalOptions,
		client?: AnkiConnectClient,
	) {
		super(app);
		this.orphans = orphans;
		this.options = modalOptions;
		this.client = client;
	}

	static open(
		app: App,
		orphans: VaultOrphan[],
		modalOptions: VaultOrphanModalOptions,
		client?: AnkiConnectClient,
	): Promise<VaultOrphanChoice> {
		return new Promise((resolve) => {
			const modal = new VaultOrphanModal(app, orphans, modalOptions, client);
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
			text: `These Anki notes are bound to vault UUIDs that no longer appear in the current sync scan. Choose what to do before Anki is modified. Ignore adds the "${this.options.ignoreTag}" tag.`,
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
				text: formatOrphanFrontPreview(orphan),
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-meta',
				text: formatOrphanDeckMeta(orphan),
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-hint',
				text: formatOrphanUuidHint(orphan),
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
		const cancelButton = footer.createEl('button', {
			text: 'Cancel (remind later)',
			type: 'button',
		});
		cancelButton.setAttr(
			'title',
			'Do not change Anki; show these orphans again on the next full-vault sync.',
		);
		cancelButton.addEventListener('click', () => {
			this.closeWithChoice('cancel');
		});

		const ignoreButton = footer.createEl('button', {
			text: 'Ignore',
			type: 'button',
		});
		ignoreButton.setAttr(
			'title',
			`Add the ${this.options.ignoreTag} tag so these notes are skipped on future syncs. Cards stay active in Anki.`,
		);
		ignoreButton.addEventListener('click', () => {
			this.closeWithChoice('ignore');
		});

		if (this.options.allowSuspend) {
			const suspendButton = footer.createEl('button', {
				text: 'Suspend',
				type: 'button',
			});
			suspendButton.setAttr(
				'title',
				'Suspend cards in Anki (hidden from review queue). The note may still appear on future syncs unless you also Ignore.',
			);
			suspendButton.addEventListener('click', () => {
				this.closeWithChoice('suspend');
			});
		}

		const deleteButton = footer.createEl('button', {
			cls: 'mod-warning',
			text: 'Delete',
			type: 'button',
		});
		deleteButton.setAttr('title', 'Permanently delete these notes from Anki.');
		deleteButton.addEventListener('click', () => {
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
