import { TFile, type MarkdownPostProcessorContext, type Plugin } from 'obsidian';
import { getBodyStartOffset } from '../../src/io/frontmatterFilter';
import { parseCardDocument } from '../../src/cardSyntax/parseCardDocument';
import type { ParseCardDocumentResult } from '../../src/cardSyntax/types';
import type { AnkiAstSyncSettings } from './settings';
import {
	CARD_PREVIEW_DEBOUNCE_MS,
	cardDeclarationHeadingSelector,
	computeContentCacheKey,
	formatCardPreviewTooltip,
	outcomeToBadgeClass,
	zipCardsToHeadings,
} from './cardPreviewUtils';

const BADGE_CLASS = 'anki-card-preview-badge';
const HEADING_OUTLINE_CLASS = 'anki-card-preview-heading';
const CACHE_LIMIT = 24;

interface CacheEntry {
	key: string;
	result: ParseCardDocumentResult;
}

export class CardPreviewManager {
	private readonly cache = new Map<string, CacheEntry>();
	private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly pendingContent = new Map<string, string>();
	private readonly previewElements = new Map<string, WeakRef<HTMLElement>>();

	constructor(
		private readonly plugin: Plugin,
		private readonly getSettings: () => AnkiAstSyncSettings,
	) {}

	register(): void {
		this.plugin.registerMarkdownPostProcessor((element, context) => {
			void this.processPreview(element, context);
		});
	}

	destroy(): void {
		for (const timer of this.pendingTimers.values()) {
			clearTimeout(timer);
		}
		this.pendingTimers.clear();
		this.pendingContent.clear();
		this.previewElements.clear();
		this.cache.clear();
	}

	onSettingsChanged(): void {
		const activePath = this.plugin.app.workspace.getActiveFile()?.path;
		if (!activePath) {
			return;
		}

		this.cache.delete(activePath);
		const preview = this.previewElements.get(activePath)?.deref();
		if (preview?.isConnected) {
			this.clearDecorations(preview);
			if (this.getSettings().enableCardPreview) {
				void this.processPreview(preview, { sourcePath: activePath } as MarkdownPostProcessorContext);
			}
		}
	}

	private async processPreview(
		element: HTMLElement,
		context: MarkdownPostProcessorContext,
	): Promise<void> {
		if (!this.getSettings().enableCardPreview) {
			return;
		}

		const sourcePath = context.sourcePath;
		if (!sourcePath) {
			return;
		}

		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile || activeFile.path !== sourcePath) {
			return;
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) {
			return;
		}

		this.previewElements.set(sourcePath, new WeakRef(element));

		const content = await this.plugin.app.vault.cachedRead(file);
		const cacheKey = computeContentCacheKey(sourcePath, content);
		const cached = this.cache.get(sourcePath);

		if (cached?.key === cacheKey) {
			this.applyDecorations(element, cached.result);
			return;
		}

		this.pendingContent.set(sourcePath, content);
		const existingTimer = this.pendingTimers.get(sourcePath);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		const timer = setTimeout(() => {
			this.pendingTimers.delete(sourcePath);
			const latestContent = this.pendingContent.get(sourcePath) ?? content;
			this.pendingContent.delete(sourcePath);

			const latestKey = computeContentCacheKey(sourcePath, latestContent);
			const latestCached = this.cache.get(sourcePath);
			if (latestCached?.key === latestKey) {
				const preview = this.previewElements.get(sourcePath)?.deref();
				if (preview?.isConnected) {
					this.applyDecorations(preview, latestCached.result);
				}
				return;
			}

			const result = parseCardDocument(latestContent, this.buildParseOptions(latestContent));
			this.setCache(sourcePath, latestKey, result);

			const preview = this.previewElements.get(sourcePath)?.deref();
			if (preview?.isConnected) {
				this.applyDecorations(preview, result);
			}
		}, CARD_PREVIEW_DEBOUNCE_MS);

		this.pendingTimers.set(sourcePath, timer);
	}

	private buildParseOptions(content: string) {
		const settings = this.getSettings();
		return {
			inferClozeFromManualSyntaxOnBasic:
				settings.inferClozeFromManualSyntaxOnBasic,
			cardDeclarationHeadingLevel: settings.defaultCardDeclarationHeadingLevel,
			delimiter: settings.delimiter,
			includeParentHeadersAsTags: settings.includeParentHeadersAsTags,
			bodyStartOffset: getBodyStartOffset(content),
		};
	}

	private setCache(sourcePath: string, key: string, result: ParseCardDocumentResult): void {
		this.cache.set(sourcePath, { key, result });
		if (this.cache.size <= CACHE_LIMIT) {
			return;
		}

		const oldestKey = this.cache.keys().next().value;
		if (oldestKey) {
			this.cache.delete(oldestKey);
		}
	}

	private clearDecorations(container: HTMLElement): void {
		container.querySelectorAll(`.${BADGE_CLASS}`).forEach((node) => node.remove());
		container.querySelectorAll(`.${HEADING_OUTLINE_CLASS}`).forEach((node) => {
			node.classList.remove(HEADING_OUTLINE_CLASS);
			for (const outcome of ['sync', 'skip', 'error', 'warn']) {
				node.classList.remove(`${HEADING_OUTLINE_CLASS}--${outcome}`);
			}
		});
	}

	private applyDecorations(
		container: HTMLElement,
		result: ParseCardDocumentResult,
	): void {
		this.clearDecorations(container);

		if (!result.syncEligible || result.cards.length === 0) {
			return;
		}

		const selector = cardDeclarationHeadingSelector(
			this.getSettings().defaultCardDeclarationHeadingLevel,
		);
		const headings = [...container.querySelectorAll<HTMLElement>(selector)];
		const pairs = zipCardsToHeadings(result.cards, headings);

		for (const { card, heading } of pairs) {
			const outcomeClass = outcomeToBadgeClass(card.outcome);
			heading.classList.add(HEADING_OUTLINE_CLASS, `${HEADING_OUTLINE_CLASS}--${outcomeClass}`);

			const badge = document.createElement('span');
			badge.className = `${BADGE_CLASS} ${BADGE_CLASS}--${outcomeClass}`;
			badge.textContent = card.outcome;
			badge.setAttribute('aria-label', formatCardPreviewTooltip(card));
			badge.title = formatCardPreviewTooltip(card);
			heading.appendChild(badge);
		}
	}
}

export function registerCardPreview(
	plugin: Plugin,
	getSettings: () => AnkiAstSyncSettings,
): CardPreviewManager {
	const manager = new CardPreviewManager(plugin, getSettings);
	manager.register();
	return manager;
}
