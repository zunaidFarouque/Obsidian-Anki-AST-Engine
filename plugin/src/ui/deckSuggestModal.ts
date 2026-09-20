import { FuzzySuggestModal, type App } from 'obsidian';

export class DeckSuggestModal extends FuzzySuggestModal<string> {
	private readonly decks: string[];
	private readonly onChooseDeck: (deck: string) => void;

	constructor(app: App, decks: string[], onChooseDeck: (deck: string) => void) {
		super(app);
		this.decks = decks;
		this.onChooseDeck = onChooseDeck;
		this.setPlaceholder('Select target Anki deck...');
	}

	getItems(): string[] {
		return this.decks;
	}

	getItemText(deck: string): string {
		return deck;
	}

	onChooseItem(deck: string): void {
		this.onChooseDeck(deck);
	}
}
