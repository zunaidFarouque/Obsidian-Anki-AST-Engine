import {
	formatResolvedCardType,
	type CardMessage,
	type DelimiterKind,
	type ResolvedCard,
	type ResolvedCardType,
	type SyncOutcome,
} from '../../src/cardSyntax/types';

export function shouldRebuildCardPreviewDecorations(input: {
	docChanged: boolean;
	viewportChanged: boolean;
	settingsRevision: number;
	lastSettingsRevision: number;
	livePreviewChanged: boolean;
	editorFileChanged: boolean;
}): boolean {
	if (input.docChanged || input.viewportChanged) {
		return true;
	}
	if (input.settingsRevision !== input.lastSettingsRevision) {
		return true;
	}
	if (input.livePreviewChanged || input.editorFileChanged) {
		return true;
	}
	return false;
}

export const CARD_PREVIEW_DEBOUNCE_MS = 400;

export function frontmatterFromObsidianMetadata(
	metadata: Record<string, unknown> | null | undefined,
): import('../../src/io/frontmatterFilter').Frontmatter | null {
	if (!metadata) {
		return null;
	}

	const fields: Record<string, string> = {};
	for (const [key, value] of Object.entries(metadata)) {
		if (value === null || value === undefined) {
			continue;
		}
		if (typeof value === 'boolean') {
			fields[key] = value ? 'true' : 'false';
			continue;
		}
		if (Array.isArray(value)) {
			fields[key] = value.map(String).join(', ');
			continue;
		}
		fields[key] = String(value);
	}

	return Object.keys(fields).length > 0 ? fields : null;
}

export const OUTCOME_BADGE_CLASS: Record<SyncOutcome, string> = {
	sync: 'sync',
	skip: 'skip',
	error: 'error',
	warn: 'warn',
};

export function hashString(content: string): string {
	let hash = 0;
	for (let index = 0; index < content.length; index += 1) {
		hash = (hash * 31 + content.charCodeAt(index)) | 0;
	}
	return (hash >>> 0).toString(36);
}

export function computeContentCacheKey(
	filePath: string,
	content: string,
	noteTypeCacheRevision = 0,
): string {
	return `${filePath}:${content.length}:${hashString(content)}:${noteTypeCacheRevision}`;
}

export function outcomeToBadgeClass(outcome: SyncOutcome): string {
	return OUTCOME_BADGE_CLASS[outcome];
}

export type CardPreviewStyle = 'subtle' | 'explicit';

function messageLevelToOutcome(level: CardMessage['level']): SyncOutcome | undefined {
	if (level === 'error') {
		return 'error';
	}
	if (level === 'warn') {
		return 'warn';
	}
	if (level === 'skip') {
		return 'skip';
	}
	return undefined;
}

export function effectivePreviewOutcome(card: Pick<ResolvedCard, 'outcome' | 'messages'>): SyncOutcome {
	let effective = card.outcome;
	for (const message of card.messages) {
		const mapped = messageLevelToOutcome(message.level);
		if (!mapped) {
			continue;
		}
		if (mapped === 'error') {
			return 'error';
		}
		if (mapped === 'warn' && effective === 'sync') {
			effective = 'warn';
		}
		if (mapped === 'skip' && effective === 'sync') {
			effective = 'skip';
		}
	}
	return effective;
}

export function computePreviewOutcomeClass(
	card: Pick<ResolvedCard, 'outcome' | 'messages'>,
	style: CardPreviewStyle = 'subtle',
): string {
	const outcomeClass = outcomeToBadgeClass(effectivePreviewOutcome(card));
	return style === 'explicit' ? `${outcomeClass}-explicit` : outcomeClass;
}

export function pickPreviewMessage(messages: CardMessage[]): string | undefined {
	return pickPrimaryPreviewMessage(messages)?.text;
}

export function pickPrimaryPreviewMessage(
	messages: CardMessage[],
): CardMessage | undefined {
	const priority: CardMessage['level'][] = ['error', 'warn', 'skip', 'info'];
	for (const level of priority) {
		const message = messages.find((entry) => entry.level === level);
		if (message) {
			return message;
		}
	}
	return undefined;
}

const CANONICAL_OUTCOME_SUFFIX = / — (skipped|warning|error)$/;

export function stripCanonicalOutcomeSuffix(text: string): string {
	return text.replace(CANONICAL_OUTCOME_SUFFIX, '');
}

function situationLabelForMessage(level: CardMessage['level']): string {
	switch (level) {
		case 'skip':
			return 'skipped';
		case 'warn':
			return 'warning';
		case 'error':
			return 'error';
		case 'info':
			return 'info';
	}
}

function detailLabelForMessage(level: CardMessage['level']): string {
	switch (level) {
		case 'warn':
			return 'Warning';
		case 'info':
			return 'Info';
		case 'error':
		case 'skip':
			return 'Problem';
	}
}

export function formatCardPreviewTooltip(card: {
	resolvedType: ResolvedCardType;
	messages: CardMessage[];
	outcome?: SyncOutcome;
}): string {
	const typeLabel = formatPreviewTypeLabel(card.resolvedType);
	const lines = [`Type: ${typeLabel}`];
	const primary = pickPrimaryPreviewMessage(card.messages);
	if (!primary) {
		return lines.join('\n');
	}

	lines.push(`Situation: ${situationLabelForMessage(primary.level)}`);
	lines.push(
		`${detailLabelForMessage(primary.level)}: ${stripCanonicalOutcomeSuffix(primary.text)}`,
	);
	return lines.join('\n');
}

function formatPreviewTypeLabel(type: ResolvedCardType): string {
	if (type.kind === 'custom') {
		return `noteType: ${type.noteTypeId}`;
	}
	return formatResolvedCardType(type);
}

export function formatProblemForHeadingContext(message: CardMessage): string {
	const text = stripCanonicalOutcomeSuffix(message.text);
	const localizedPattern = /\b(delimiter|line|field|token)\b/i;
	if (localizedPattern.test(text)) {
		return `Localized line issue: ${text}`;
	}
	return `Summary issue: ${text}`;
}

export function buildLightweightTooltip(card: {
	resolvedType: ResolvedCardType;
	messages: CardMessage[];
	resolvedFrom: string;
	outcome?: SyncOutcome;
}): string {
	const lines = [formatCardPreviewTooltip(card)];
	lines.push(`Resolved from: ${card.resolvedFrom}`);
	return lines.join('\n');
}

export function zipCardsToHeadings<T>(
	cards: ResolvedCard[],
	headings: T[],
): Array<{ card: ResolvedCard; heading: T }> {
	const count = Math.min(cards.length, headings.length);
	return Array.from({ length: count }, (_, index) => ({
		card: cards[index]!,
		heading: headings[index]!,
	}));
}

export function cardDeclarationHeadingSelector(level: number): string {
	const clamped = Math.min(6, Math.max(1, level));
	return `h${clamped}`;
}

export interface DocumentLine {
	from: number;
	to: number;
	text: string;
}

export interface CardHeadingLinePosition {
	from: number;
	to: number;
}

export interface HeadingBadgeModel {
	displayOutcome: SyncOutcome;
	label: string;
}

export interface DelimiterLineDecorationModel {
	start: number;
	end: number;
	isPrimary: boolean;
	garnishText?: string;
	discouragementText?: string;
}

export interface ClozeTokenDecorationModel {
	start: number;
	end: number;
	groupId: string;
	paletteClass: string;
}

export interface BackOnlyClozeWarningMeta {
	hasBackOnlyWarning: boolean;
	ruleId?: string;
}

const OUTCOME_SUFFIX: Partial<Record<SyncOutcome, string>> = {
	skip: '⛔',
	warn: '⚠️',
	error: '❌',
};

const CLOZE_GROUP_PALETTE_SIZE = 4;

export function buildHeadingBadgeModel(card: ResolvedCard): HeadingBadgeModel {
	const displayOutcome = effectivePreviewOutcome(card);
	const typeLabel = formatResolvedCardType(card.resolvedType);
	const suffix = OUTCOME_SUFFIX[displayOutcome];
	return {
		displayOutcome,
		label: suffix ? `${typeLabel} ${suffix}` : typeLabel,
	};
}

export function findLineRangeForOffset(
	lines: DocumentLine[],
	offset: number,
): CardHeadingLinePosition | undefined {
	const line = lines.find((entry) => offset >= entry.from && offset <= entry.to);
	if (!line) {
		return undefined;
	}
	return { from: line.from, to: line.to };
}

export function findCardHeadingLinePositions(
	lines: DocumentLine[],
	headingLevel: number,
	bodyStartOffset: number,
): CardHeadingLinePosition[] {
	const clampedLevel = Math.min(6, Math.max(1, headingLevel));
	const markPrefix = '#'.repeat(clampedLevel);
	const requiredPrefix = `${markPrefix} `;
	const positions: CardHeadingLinePosition[] = [];

	for (const line of lines) {
		if (line.from < bodyStartOffset) {
			continue;
		}

		if (!line.text.startsWith(requiredPrefix)) {
			continue;
		}

		if (line.text.length > requiredPrefix.length && line.text[requiredPrefix.length] === '#') {
			continue;
		}

		positions.push({ from: line.from, to: line.to });
	}

	return positions;
}

function delimiterGarnish(card: ResolvedCard, kind: DelimiterKind): string | undefined {
	if (card.resolvedType.kind !== 'builtin') {
		return undefined;
	}
	// Tag-resolved reversible/typed use plain :::; :::r / :::t also accepted (§5.7).
	if (card.resolvedType.type === 'reversible' && (kind === ':::' || kind === ':::r')) {
		return '↑↓';
	}
	if (card.resolvedType.type === 'typed' && (kind === ':::' || kind === ':::t')) {
		return '⌨';
	}
	if (card.resolvedType.type === 'cloze' && kind === ':::') {
		return 'ℹ';
	}
	return undefined;
}

function isStructuralDelimiter(kind: DelimiterKind): boolean {
	return kind === ':::' || kind === ':::r' || kind === ':::t';
}

export function buildDelimiterLineDecorations(card: ResolvedCard): DelimiterLineDecorationModel[] {
	const structural = card.regions.delimiters.filter((delimiter) => isStructuralDelimiter(delimiter.kind));
	return structural.map((delimiter, index) => ({
		start: delimiter.range.start,
		end: delimiter.range.end,
		isPrimary: index === 0,
		garnishText: index === 0 ? delimiterGarnish(card, delimiter.kind) : undefined,
		discouragementText: index > 0 ? 'Extra delimiter ignored (still Back region)' : undefined,
	}));
}

function clozeGroupToPaletteClass(groupId: string): string {
	const raw = groupId === 'shorthand' ? 1 : Number.parseInt(groupId.slice(1), 10);
	const normalized = Number.isFinite(raw) && raw > 0 ? raw : 1;
	const paletteIndex = ((normalized - 1) % CLOZE_GROUP_PALETTE_SIZE) + 1;
	return `anki-card-preview-cloze-group-${paletteIndex}`;
}

export function buildClozeTokenDecorations(
	card: ResolvedCard,
	content: string,
): ClozeTokenDecorationModel[] {
	if (card.resolvedType.kind !== 'builtin' || card.resolvedType.type !== 'cloze') {
		return [];
	}
	const textRegion = card.regions.text;
	if (!textRegion) {
		return [];
	}

	const source = content.slice(textRegion.start, textRegion.end);
	const tokenPattern = /\{\{(?:(c\d+)::)?[^{}]*\}\}/g;
	const tokens: ClozeTokenDecorationModel[] = [];
	let match: RegExpExecArray | null;
	while ((match = tokenPattern.exec(source)) !== null) {
		const groupId = match[1] ?? 'shorthand';
		const start = textRegion.start + match.index;
		tokens.push({
			start,
			end: start + match[0].length,
			groupId,
			paletteClass: clozeGroupToPaletteClass(groupId),
		});
	}
	return tokens;
}

export function buildBackOnlyClozeWarningMeta(card: ResolvedCard): BackOnlyClozeWarningMeta {
	const warning = card.messages.find(
		(message) =>
			message.level === 'warn' &&
			(message.ruleId === 'CLZ-11' || message.ruleId === 'BAS-05') &&
			message.text.includes('{{'),
	);
	if (!warning) {
		return { hasBackOnlyWarning: false };
	}
	return { hasBackOnlyWarning: true, ruleId: warning.ruleId };
}

export const NOTE_TYPE_CACHE_NOTICE_MAX_NAMES = 8;

export type NoteTypeCacheRefreshResult =
	| { ok: true; noteTypeNames: string[]; noteTypeFieldMap: Record<string, string[]> }
	| { ok: false; error: string };

export function formatNoteTypeCacheNotice(
	result: NoteTypeCacheRefreshResult,
	options?: { maxNames?: number },
): string {
	if (!result.ok) {
		return `Failed to refresh note type cache: ${result.error}`;
	}

	const count = result.noteTypeNames.length;
	const maxNames = options?.maxNames ?? NOTE_TYPE_CACHE_NOTICE_MAX_NAMES;
	const shown = result.noteTypeNames.slice(0, maxNames);
	const remaining = count - shown.length;
	const namesPart =
		remaining > 0 ? `${shown.join(', ')}, and ${remaining} more` : shown.join(', ');
	const label = count === 1 ? 'note type' : 'note types';
	return `Refreshed ${count} ${label}: ${namesPart}`;
}

export function buildNoteTypeCacheRefreshResult(
	map: Record<string, string[]>,
): NoteTypeCacheRefreshResult {
	const noteTypeNames = Object.keys(map);
	if (noteTypeNames.length === 0) {
		return { ok: false, error: 'AnkiConnect returned no note types' };
	}
	return { ok: true, noteTypeNames, noteTypeFieldMap: map };
}

export async function performNoteTypeCacheRefresh(
	fetchMap: () => Promise<Record<string, string[]>>,
): Promise<NoteTypeCacheRefreshResult> {
	try {
		const map = await fetchMap();
		return buildNoteTypeCacheRefreshResult(map);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: message };
	}
}

export async function refreshNoteTypeMapFromHook(
	hook: (() => Promise<Record<string, string[]>>) | undefined,
): Promise<NoteTypeCacheRefreshResult> {
	if (!hook) {
		return {
			ok: false,
			error: 'Note type refresh unavailable (connector not configured).',
		};
	}
	return performNoteTypeCacheRefresh(hook);
}
