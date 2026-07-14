import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	ANKI_SYNC_STAR_ICON_ID,
	getAnkiSyncStarIconSvg,
	registerPluginIcons,
} from '../../plugin/src/icons';

const PLUGIN_ROOT = join(import.meta.dir, '../../plugin');
const SVG_PATH = join(PLUGIN_ROOT, 'src/icons/anki-sync-star.svg');

describe('plugin icons', () => {
	test('anki-sync-star.svg exists with the Anki solid-star path', () => {
		const svg = readFileSync(SVG_PATH, 'utf8');
		expect(svg).toContain('viewBox="0 0 50 50"');
		expect(svg).toContain('M37.38,2H12.84');
		expect(svg).toContain('M30.71,31.57');
	});

	test('getAnkiSyncStarIconSvg returns embedded svg markup', () => {
		const svg = getAnkiSyncStarIconSvg();
		expect(svg).toContain('<svg');
		expect(svg).toContain('M37.38,2H12.84');
	});

	test('registerPluginIcons registers the sync star icon', () => {
		const registered: Array<{ id: string; svg: string }> = [];
		registerPluginIcons((id, svg) => {
			registered.push({ id, svg });
		});
		expect(registered).toEqual([
			{ id: ANKI_SYNC_STAR_ICON_ID, svg: getAnkiSyncStarIconSvg() },
		]);
	});
});
