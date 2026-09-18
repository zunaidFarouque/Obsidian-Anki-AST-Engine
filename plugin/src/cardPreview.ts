import {
	TFile,
	editorInfoField,
	editorLivePreviewField,
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
import type { AnkiAstSyncSettings } from './settings';
import { createCardPreviewEditorExtension } from './cardPreviewEditor';
import { applyCardPreviewLayoutCssVariables } from './cardPreviewLayout';
import {
	computeContentCacheKey,
	frontmatterFromObsidianMetadata,
	refreshNoteTypeMapFromHook,
	type NoteTypeCacheRefreshResult,
} from './cardPreviewUtils';

const CACHE_LIMIT = 24;

interface CacheEntry {
	key: string;
	result: ParseCardDocumentResult;
}

export class CardPreviewManager {
	private readonly cache = new Map<string, CacheEntry>();
	private settingsRevision = 0;
	private noteTypeFieldNamesByNoteType: Record<string, string[]> = {};
	private noteTypeCacheRevision = 0;

	constructor(
		private readonly plugin: Plugin,
		private readonly getSettings: () => AnkiAstSyncSettings,
		private readonly refreshNoteTypeMapHook?: () => Promise<Record<string, string[]>>,
	) {}

	register(): void {
		applyCardPreviewLayoutCssVariables(this.getSettings());
		const editorOptions = {
			getSettings: () => this.getSettings(),
			parseContent: (content: string, file?: TFile) => this.parseContent(content, file),
			getCardDeclarationHeadingLevel: (content: string, file?: TFile) =>
				this.getCardDeclarationHeadingLevel(content, file),
			getSettingsRevision: () => this.settingsRevision,
			openCardPreviewDetails: (card: ParseCardDocumentResult['cards'][number], filePath: string) => {
				void this.openCardPreviewModal(filePath, card);
			},
			editorLivePreviewField,
			editorInfoField,
		};
		this.plugin.registerEditorExtension(createCardPreviewEditorExtension(editorOptions));
	}

	destroy(): void {
		this.cache.clear();
	}

	onSettingsChanged(): void {
		this.settingsRevision += 1;
		applyCardPreviewLayoutCssVariables(this.getSettings());
		this.cache.clear();
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

	getNoteTypeFieldMap(): Record<string, string[]> {
		return this.noteTypeFieldNamesByNoteType;
	}

	parseContent(content: string, file?: TFile): ParseCardDocumentResult {
		const sourcePath = file?.path ?? '__ephemeral__';
		const cacheKey = `${computeContentCacheKey(
			sourcePath,
			content,
			this.noteTypeCacheRevision,
		)}:${this.settingsRevision}`;

		const cached = this.cache.get(sourcePath);
		if (cached?.key === cacheKey) {
			return cached.result;
		}

		const result = parseCardDocument(content, this.buildParseOptions(content, file));
		this.setCache(sourcePath, cacheKey, result);
		return result;
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
			customLayoutMap: settings.customLayoutMap,
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

	private async openCardPreviewModal(
		sourcePath: string,
		card: ParseCardDocumentResult['cards'][number],
	): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) {
			return;
		}
		const { CardPreviewModal } = await import('./cardPreviewModal');
		const customFields =
			card.resolvedType.kind === 'custom'
				? this.noteTypeFieldNamesByNoteType[card.resolvedType.noteTypeId]
				: undefined;
		new CardPreviewModal(this.plugin.app, card, file, card.range.start, customFields).open();
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
