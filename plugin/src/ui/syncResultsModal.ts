import { App, Modal } from 'obsidian';
import type {
	DuplicateWarning,
	MediaBasenameWarning,
	OrphanAction,
	SyncAction,
	SyncSummary,
	VaultOrphan,
} from 'obsidian-anki-ast-engine/sync';
import { stripHtmlForSearch } from 'obsidian-anki-ast-engine/sync';
import { openVaultCard } from '../navigation/openVaultCard';
import {
	basename,
	duplicateWarningLabel,
	formatOrphanDeckMeta,
	formatOrphanFrontPreview,
	formatOrphanUuidHint,
	truncate,
} from './syncDisplayUtils';

export type SyncResultsPayload = {
	dryRun: boolean;
	summary: SyncSummary;
	actions: SyncAction[];
	duplicateWarnings: DuplicateWarning[];
	mediaWarnings: MediaBasenameWarning[];
	skippedDuplicateFrontCount?: number;
	orphans?: VaultOrphan[];
	orphanActions?: OrphanAction[];
	orphanChoice?: 'cancel' | 'ignore' | 'delete' | 'suspend';
	orphanIgnoreTag?: string;
};

type DuplicateWarningEntry = {
	file: string;
	tag: string;
	frontPreview: string;
	label: string;
};

function collectDuplicateWarningEntries(
	warnings: DuplicateWarning[],
): DuplicateWarningEntry[] {
	const entries: DuplicateWarningEntry[] = [];

	for (const warning of warnings) {
		if (warning.kind === 'anki_duplicate_recovered') {
			continue;
		}

		const frontPreview = truncate(stripHtmlForSearch(warning.frontHtml), 120);
		const label = duplicateWarningLabel(warning);
		for (const source of warning.sources) {
			entries.push({
				file: source.file,
				tag: source.tag,
				frontPreview,
				label,
			});
		}
	}

	return entries;
}

export class SyncResultsModal extends Modal {
	private readonly payload: SyncResultsPayload;

	constructor(app: App, payload: SyncResultsPayload) {
		super(app);
		this.payload = payload;
	}

	static open(app: App, payload: SyncResultsPayload): void {
		new SyncResultsModal(app, payload).open();
	}

	onOpen(): void {
		const { contentEl, titleEl, modalEl } = this;
		const { dryRun, summary } = this.payload;

		modalEl.addClass('anki-ast-sync-results-modal');
		titleEl.setText(dryRun ? 'Dry-run sync results' : 'Sync results');
		contentEl.empty();

		const scroll = contentEl.createDiv({ cls: 'anki-ast-sync-results-scroll' });

		scroll.createEl('p', {
			cls: 'anki-ast-sync-results-summary',
			text: dryRun
				? `Would add ${summary.added}, update ${summary.updated}, skip ${summary.skipped}, fail ${summary.failed}`
				: `Added ${summary.added}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}`,
		});

		this.renderFailedSection(scroll);
		this.renderSkippedConflictsSection(scroll);
		this.renderDuplicateSection(scroll);
		this.renderMediaSection(scroll);
		this.renderOrphanSection(scroll);

		const footer = contentEl.createDiv({ cls: 'anki-ast-sync-duplicate-footer' });
		footer
			.createEl('button', { cls: 'mod-cta', text: 'Close', type: 'button' })
			.addEventListener('click', () => {
				this.close();
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderFailedSection(container: HTMLElement): void {
		const failed = this.payload.actions.filter((action) => action.syncError);
		if (failed.length === 0) {
			return;
		}

		container.createEl('h3', { cls: 'anki-ast-sync-results-heading', text: 'Failed cards' });
		const list = container.createEl('ul', { cls: 'anki-ast-sync-duplicate-list' });

		for (const action of failed) {
			const item = list.createEl('li');
			const button = item.createEl('button', {
				cls: 'anki-ast-sync-duplicate-item',
				type: 'button',
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-front',
				text: truncate(action.syncError ?? 'Unknown error', 160),
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-meta',
				text: `${basename(action.file)} · ${action.tag}`,
			});
			button.addEventListener('click', () => {
				void openVaultCard(this.app, action.file, action.tag);
			});
		}
	}

	private renderSkippedConflictsSection(container: HTMLElement): void {
		const count = this.payload.skippedDuplicateFrontCount ?? 0;
		if (count === 0) {
			return;
		}

		container.createEl('h3', {
			cls: 'anki-ast-sync-results-heading',
			text: 'Skipped duplicate fronts',
		});
		container.createEl('p', {
			cls: 'anki-ast-sync-results-note',
			text: `${count} card(s) were skipped due to duplicate fronts. Fix conflicts and sync again.`,
		});
	}

	private renderDuplicateSection(container: HTMLElement): void {
		const entries = collectDuplicateWarningEntries(this.payload.duplicateWarnings);
		if (entries.length === 0) {
			return;
		}

		container.createEl('h3', {
			cls: 'anki-ast-sync-results-heading',
			text: 'Duplicate warnings',
		});
		const list = container.createEl('ul', { cls: 'anki-ast-sync-duplicate-list' });

		for (const entry of entries) {
			const item = list.createEl('li');
			const button = item.createEl('button', {
				cls: 'anki-ast-sync-duplicate-item',
				type: 'button',
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-front',
				text: `${entry.label}: ${entry.frontPreview}`,
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-meta',
				text: `${basename(entry.file)} · ${entry.tag}`,
			});
			button.addEventListener('click', () => {
				void openVaultCard(this.app, entry.file, entry.tag);
			});
		}
	}

	private renderMediaSection(container: HTMLElement): void {
		if (this.payload.mediaWarnings.length === 0) {
			return;
		}

		container.createEl('h3', {
			cls: 'anki-ast-sync-results-heading',
			text: 'Media warnings',
		});
		const list = container.createEl('ul', { cls: 'anki-ast-sync-duplicate-list' });

		for (const warning of this.payload.mediaWarnings) {
			const item = list.createEl('li');
			const button = item.createEl('button', {
				cls: 'anki-ast-sync-duplicate-item',
				type: 'button',
			});
			button.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-front',
				text: warning.message,
			});

			const paths = warning.sources
				.map((source) => source.vaultRelativePath)
				.join(', ');
			if (paths) {
				button.createEl('span', {
					cls: 'anki-ast-sync-duplicate-item-meta',
					text: paths,
				});
			}

			const firstPath = warning.sources[0]?.vaultRelativePath;
			if (firstPath) {
				button.addEventListener('click', () => {
					void openVaultCard(this.app, firstPath, '');
				});
			} else {
				button.disabled = true;
			}
		}
	}

	private renderOrphanSection(container: HTMLElement): void {
		const orphans = this.payload.orphans ?? [];
		if (orphans.length === 0) {
			return;
		}

		container.createEl('h3', {
			cls: 'anki-ast-sync-results-heading',
			text: 'Orphaned notes',
		});

		const { dryRun, orphanChoice, orphanActions, orphanIgnoreTag } = this.payload;
		const ignoreTag = orphanIgnoreTag ?? 'obsidian-sync-ignore';
		let summary: string;
		if (dryRun) {
			summary = `${orphans.length} orphaned Anki note(s) would be reported on a live sync.`;
		} else if (orphanChoice === 'ignore') {
			summary = `Tagged ${orphanActions?.length ?? orphans.length} orphaned note(s) with ${ignoreTag}; they will not be prompted again.`;
		} else if (orphanChoice === 'suspend') {
			summary = `Suspended ${orphanActions?.length ?? orphans.length} orphaned note(s).`;
		} else if (orphanChoice === 'delete') {
			summary = `Deleted ${orphanActions?.length ?? orphans.length} orphaned note(s).`;
		} else {
			summary = `Found ${orphans.length} orphaned note(s); no action taken.`;
		}

		container.createEl('p', {
			cls: 'anki-ast-sync-results-note',
			text: summary,
		});

		const list = container.createEl('ul', { cls: 'anki-ast-sync-duplicate-list' });
		for (const orphan of orphans) {
			const item = list.createEl('li');
			item.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-front',
				text: formatOrphanFrontPreview(orphan),
			});
			item.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-meta',
				text: formatOrphanDeckMeta(orphan),
			});
			item.createEl('span', {
				cls: 'anki-ast-sync-duplicate-item-hint',
				text: formatOrphanUuidHint(orphan),
			});
		}
	}
}
