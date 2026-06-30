import { Modal, Notice, TFile, type App } from 'obsidian';
import {
	formatResolvedCardType,
	type ResolvedCard,
} from '../../src/cardSyntax/types';
import {
	buildModalSections,
	buildStructureTemplateLines,
	insertTemplateAfterDeclarationHeading,
} from './cardPreviewModalContent';

export class CardPreviewModal extends Modal {
	constructor(
		app: App,
		private readonly card: ResolvedCard,
		private readonly file: TFile,
		private readonly headingStartOffset: number,
		private readonly customFields?: string[],
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(`Card preview: ${formatResolvedCardType(this.card.resolvedType)}`);
		const { contentEl } = this;
		contentEl.empty();

		const sections = buildModalSections(this.card);
		for (const section of sections) {
			const sectionEl = contentEl.createDiv({ cls: 'anki-card-preview-modal-section' });
			sectionEl.createEl('h4', { text: section.title });
			for (const line of section.lines) {
				sectionEl.createEl('p', { text: line });
			}
		}

		const actionsSection = contentEl.createDiv({ cls: 'anki-card-preview-modal-section' });
		const insertButton = actionsSection.createEl('button', { text: 'Insert structure template' });
		insertButton.addEventListener('click', () => {
			void this.insertStructureTemplate();
		});
	}

	private async insertStructureTemplate(): Promise<void> {
		const content = await this.app.vault.cachedRead(this.file);
		const nextContent = insertTemplateAfterDeclarationHeading(
			content,
			this.headingStartOffset,
			buildStructureTemplateLines(this.card.resolvedType, this.customFields),
		);
		await this.app.vault.modify(this.file, nextContent);
		new Notice('Inserted structure template');
	}
}
