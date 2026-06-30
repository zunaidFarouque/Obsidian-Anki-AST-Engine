import {
	TFile,
	editorInfoField,
	editorLivePreviewField,
	type MarkdownPostProcessorContext,
	type Plugin,
} from 'obsidian';
import {
	getBodyStartOffset,
	getCardDeclarationHeadingLevelFromFrontmatter,
	getDelimiterFromFrontmatter,
	getIncludeParentHeadersAsTagsFromFrontmatter,
	parseCardDocument,
	parseFrontmatter,
	type ParseCardDocumentResult,
} from 'obsidian-anki-ast-engine/cardSyntax';
import { formatResolvedCardType } from '../../src/cardSyntax/types';
import type { AnkiAstSyncSettings } from './settings';
import { createCardPreviewEditorExtension } from './cardPreviewEditor';
import {
	CARD_PREVIEW_DEBOUNCE_MS,
	cardDeclarationHeadingSelector,
	buildLightweightTooltip,
	computePreviewOutcomeClass,
	computeContentCacheKey,
	frontmatterFromObsidianMetadata,
	refreshNoteTypeMapFromHook,
	type NoteTypeCacheRefreshResult,
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
	private settingsRevision = 0;
	private noteTypeFieldNamesByNoteType: Record<string, string[]> = {};
	private noteTypeCacheRevision = 0;

	constructor(
		private readonly plugin: Plugin,
		private readonly getSettings: () => AnkiAstSyncSettings,
		private readonly refreshNoteTypeMapHook?: () => Promise<Record<string, string[]>>,
	) {}

	register(): void {
		this.plugin.registerEditorExtension(
			createCardPreviewEditorExtension({
				getSettings: () => this.getSettings(),
				parseContent: (content, file) => this.parseContent(content, file),
				getCardDeclarationHeadingLevel: (content, file) =>
					this.getCardDeclarationHeadingLevel(content, file),
				getSettingsRevision: () => this.settingsRevision,
				openCardPreviewDetails: (card, filePath) => {
					void this.openCardPreviewModal(filePath, card);
				},
				editorLivePreviewField,
				editorInfoField,
			}),
		);
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
		this.settingsRevision += 1;
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

	async refreshNoteTypeMap(): Promise<NoteTypeCacheRefreshResult> {
		const result = await refreshNoteTypeMapFromHook(this.refreshNoteTypeMapHook);
		if (!result.ok) {
			return result;
		}
		this.noteTypeFieldNamesByNoteType = result.noteTypeFieldMap;
		this.noteTypeCacheRevision += 1;
		this.onSettingsChanged();
		return result;
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

		const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) {
			return;
		}

		this.previewElements.set(sourcePath, new WeakRef(element));

		const content = await this.plugin.app.vault.cachedRead(file);
		const cacheKey = computeContentCacheKey(sourcePath, content, this.noteTypeCacheRevision);
		const cached = this.cache.get(sourcePath);

		if (cached?.key === cacheKey) {
			this.applyDecorations(element, cached.result, sourcePath);
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

			const latestKey = computeContentCacheKey(
				sourcePath,
				latestContent,
				this.noteTypeCacheRevision,
			);
			const latestCached = this.cache.get(sourcePath);
			if (latestCached?.key === latestKey) {
				const preview = this.previewElements.get(sourcePath)?.deref();
				if (preview?.isConnected) {
					this.applyDecorations(preview, latestCached.result, sourcePath);
				}
				return;
			}

			const result = this.parseContent(latestContent);
			this.setCache(sourcePath, latestKey, result);

			const preview = this.previewElements.get(sourcePath)?.deref();
			if (preview?.isConnected) {
				this.applyDecorations(preview, result, sourcePath);
			}
		}, CARD_PREVIEW_DEBOUNCE_MS);

		this.pendingTimers.set(sourcePath, timer);
	}

	parseContent(content: string, file?: TFile): ParseCardDocumentResult {
		return parseCardDocument(content, this.buildParseOptions(content, file));
	}

	getCardDeclarationHeadingLevel(content: string, file?: TFile): number {
		const settings = this.getSettings();
		const effectiveFrontmatter = this.resolveEffectiveFrontmatter(content, file);
		return getCardDeclarationHeadingLevelFromFrontmatter(
			effectiveFrontmatter,
			settings.defaultCardDeclarationHeadingLevel,
		);
	}

	private resolveEffectiveFrontmatter(content: string, file?: TFile) {
		const inlineFrontmatter = parseFrontmatter(content);
		if (inlineFrontmatter) {
			return inlineFrontmatter;
		}
		if (!file) {
			return null;
		}
		return frontmatterFromObsidianMetadata(
			this.plugin.app.metadataCache.getFileCache(file)?.frontmatter,
		);
	}

	private buildParseOptions(content: string, file?: TFile) {
		const settings = this.getSettings();
		const inlineFrontmatter = parseFrontmatter(content);
		const effectiveFrontmatter = this.resolveEffectiveFrontmatter(content, file);
		const frontmatterForOptions = effectiveFrontmatter;

		return {
			inferClozeFromManualSyntaxOnBasic:
				settings.inferClozeFromManualSyntaxOnBasic,
			cardDeclarationHeadingLevel: getCardDeclarationHeadingLevelFromFrontmatter(
				frontmatterForOptions,
				settings.defaultCardDeclarationHeadingLevel,
			),
			delimiter: getDelimiterFromFrontmatter(frontmatterForOptions, settings.delimiter),
			includeParentHeadersAsTags: getIncludeParentHeadersAsTagsFromFrontmatter(
				frontmatterForOptions,
				settings.includeParentHeadersAsTags,
			),
			bodyStartOffset: inlineFrontmatter ? getBodyStartOffset(content) : 0,
			noteTypeFieldNamesByNoteType: this.noteTypeFieldNamesByNoteType,
			externalFrontmatter: inlineFrontmatter ? undefined : effectiveFrontmatter,
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
		sourcePath: string,
	): void {
		this.clearDecorations(container);

		if (!result.syncEligible || result.cards.length === 0) {
			return;
		}

		const selector = cardDeclarationHeadingSelector(
			this.getSettings().defaultCardDeclarationHeadingLevel,
		);
		const headings = Array.from(container.querySelectorAll<HTMLElement>(selector));
		const pairs = zipCardsToHeadings(result.cards, headings);

		for (const { card, heading } of pairs) {
			const outcomeClass = computePreviewOutcomeClass(
				card,
				this.getSettings().cardPreviewStyle ?? 'subtle',
			);
			heading.classList.add(HEADING_OUTLINE_CLASS, `${HEADING_OUTLINE_CLASS}--${outcomeClass}`);

			const badge = document.createElement('span');
			badge.className = `${BADGE_CLASS} ${BADGE_CLASS}--${outcomeClass}`;
			badge.textContent = formatResolvedCardType(card.resolvedType);
			const tooltip = buildLightweightTooltip(card);
			badge.setAttribute('aria-label', tooltip);
			badge.title = tooltip;

			const moreAction = document.createElement('button');
			moreAction.type = 'button';
			moreAction.textContent = 'More';
			moreAction.className = `${BADGE_CLASS}-more`;
			moreAction.setAttribute('aria-label', 'Open card preview details');
			moreAction.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				void this.openCardPreviewModal(sourcePath, card);
			});
			badge.appendChild(moreAction);
			heading.appendChild(badge);
		}
	}

	private async openCardPreviewModal(
		sourcePath: string,
		card: ParseCardDocumentResult['cards'][number],
	): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) {
			return;
		}
		const { CardPreviewModal } = await import('./cardPreviewModal');
		new CardPreviewModal(this.plugin.app, card, file, card.range.start).open();
	}
}

export function registerCardPreview(
	plugin: Plugin,
	getSettings: () => AnkiAstSyncSettings,
	refreshNoteTypeMapHook?: () => Promise<Record<string, string[]>>,
): CardPreviewManager {
	const manager = new CardPreviewManager(plugin, getSettings, refreshNoteTypeMapHook);
	manager.register();
	return manager;
}
