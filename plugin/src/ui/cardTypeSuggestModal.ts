import { FuzzySuggestModal, type App } from 'obsidian';
import type { CardTemplateKind } from '../helpers/cardTemplateUtils';

export interface BuiltInCardChoice {
	kind: 'built-in';
	type: CardTemplateKind;
	label: string;
	description: string;
}

export interface CustomCardChoice {
	kind: 'custom';
	type: string;
	label: string;
	description: string;
	fields: string[];
}

export type CardTypeChoice = BuiltInCardChoice | CustomCardChoice;

export class CardTypeSuggestModal extends FuzzySuggestModal<CardTypeChoice> {
	private readonly choices: CardTypeChoice[];
	private readonly onSelect: (choice: CardTypeChoice) => void;

	constructor(
		app: App,
		customNoteTypes: Record<string, string[]> | undefined,
		onSelect: (choice: CardTypeChoice) => void,
	) {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder('Choose a card template to insert...');

		const items: CardTypeChoice[] = [
			{
				kind: 'built-in',
				type: 'basic',
				label: 'Basic Card',
				description: 'Front ::: Back',
			},
			{
				kind: 'built-in',
				type: 'reversible',
				label: 'Reversible Card',
				description: 'Front :::r Back (generates forward & reverse cards)',
			},
			{
				kind: 'built-in',
				type: 'typed',
				label: 'Typed Card',
				description: 'Prompt :::t Answer (type in the answer in Anki)',
			},
			{
				kind: 'built-in',
				type: 'cloze',
				label: 'Cloze Card',
				description: '{{c1::Cloze deletion}} ::: Optional back extra',
			},
		];

		if (customNoteTypes) {
			for (const [modelName, fields] of Object.entries(customNoteTypes)) {
				// Skip stock models that match built-in types to avoid duplication
				const lower = modelName.toLowerCase();
				if (
					lower === 'basic' ||
					lower === 'cloze' ||
					lower.includes('reversed') ||
					lower.includes('type in the answer')
				) {
					continue;
				}

				items.push({
					kind: 'custom',
					type: modelName,
					label: `Custom: ${modelName}`,
					description: fields.length > 0 ? `Fields: ${fields.join(', ')}` : 'Custom fields',
					fields,
				});
			}
		}

		this.choices = items;
	}

	getItems(): CardTypeChoice[] {
		return this.choices;
	}

	getItemText(item: CardTypeChoice): string {
		return `${item.label} ${item.description}`;
	}

	renderSuggestion(item: { item: CardTypeChoice }, el: HTMLElement): void {
		const container = el.createDiv({ cls: 'anki-card-type-suggestion' });
		container.createDiv({ text: item.item.label, cls: 'suggestion-title' });
		container.createDiv({ text: item.item.description, cls: 'suggestion-note' });
	}

	onChooseItem(item: CardTypeChoice): void {
		this.onSelect(item);
	}
}
