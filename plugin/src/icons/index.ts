import ankiSyncStarSvg from './anki-sync-star.svg';

export const ANKI_SYNC_STAR_ICON_ID = 'anki-ast-sync-star';

export function getAnkiSyncStarIconSvg(): string {
	return ankiSyncStarSvg;
}

export function registerPluginIcons(
	addIconImpl: (id: string, svg: string) => void,
): void {
	addIconImpl(ANKI_SYNC_STAR_ICON_ID, getAnkiSyncStarIconSvg());
}
