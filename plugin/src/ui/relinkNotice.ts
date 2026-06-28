import { Notice } from 'obsidian';
import type { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';
import type { DuplicateWarning } from 'obsidian-anki-ast-engine/sync';
import { openAnkiNote } from '../navigation/openAnkiNote';
import { openVaultCard } from '../navigation/openVaultCard';
import type { App } from 'obsidian';

const RELINK_NOTICE_DURATION_MS = 30_000;

export function showRelinkNotice(
	app: App,
	client: AnkiConnectClient,
	warning: DuplicateWarning,
): void {
	const source = warning.sources[0];
	const notice = new Notice('', RELINK_NOTICE_DURATION_MS);
	notice.noticeEl.empty();

	notice.noticeEl.createEl('div', {
		text: `Re-linked to existing Anki note ${warning.ankiNoteId ?? 'unknown'} in deck "${warning.deck}".`,
	});

	const links = notice.noticeEl.createEl('div', { cls: 'anki-ast-sync-relink-links' });

	if (source?.file) {
		const vaultLink = links.createEl('a', {
			href: '#',
			text: 'Open in vault',
		});
		vaultLink.addEventListener('click', (event) => {
			event.preventDefault();
			void openVaultCard(app, source.file, source.tag);
		});
	}

	if (warning.ankiNoteId !== undefined) {
		if (source?.file) {
			links.createEl('span', { text: ' · ' });
		}

		const ankiLink = links.createEl('a', {
			href: '#',
			text: 'Open in Anki',
		});
		ankiLink.addEventListener('click', (event) => {
			event.preventDefault();
			void openAnkiNote(client, warning.ankiNoteId!);
		});
	}
}
