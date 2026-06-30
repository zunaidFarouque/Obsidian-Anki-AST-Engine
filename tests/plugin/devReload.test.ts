import { describe, expect, test } from 'bun:test';
import type { PluginManifest } from 'obsidian';
import {
	applyPluginStylesToHead,
	findPluginStyleElement,
	resolvePluginStylesPath,
	reloadPluginCss,
	type StyleDocument,
} from '../../plugin/src/devReload';

const PLUGIN_ID = 'obsidian-anki-ast-sync';

function manifest(dir?: string): PluginManifest {
	return {
		id: PLUGIN_ID,
		name: 'Obsidian Anki AST Sync',
		version: '0.1.0',
		minAppVersion: '1.5.0',
		description: 'test',
		author: 'test',
		dir,
	};
}

function createStyleDocument(): StyleDocument {
	const elementsById = new Map<string, HTMLElement>();
	const headChildren: HTMLElement[] = [];

	const doc: StyleDocument = {
		getElementById(id: string) {
			return elementsById.get(id) ?? null;
		},
		querySelector(selector: string) {
			if (selector === `style[data-name="${PLUGIN_ID}"]`) {
				return headChildren.find((el) => el.getAttribute('data-name') === PLUGIN_ID) ?? null;
			}
			return null;
		},
		createElement(tagName: string) {
			const el = {
				id: '',
				textContent: '',
				getAttribute(name: string) {
					return (el as unknown as Record<string, string>)[name] ?? null;
				},
				setAttribute(name: string, value: string) {
					(el as unknown as Record<string, string>)[name] = value;
				},
			} as unknown as HTMLElement;
			if (tagName !== 'style') {
				throw new Error(`unexpected tag: ${tagName}`);
			}
			return el;
		},
		head: {
			appendChild(node: HTMLElement) {
				headChildren.push(node);
				if (node.id) {
					elementsById.set(node.id, node);
				}
			},
		},
	};

	return doc;
}

describe('devReload', () => {
	test('resolvePluginStylesPath joins manifest dir with styles.css', () => {
		expect(resolvePluginStylesPath(manifest('.obsidian/plugins/obsidian-anki-ast-sync'))).toBe(
			'.obsidian/plugins/obsidian-anki-ast-sync/styles.css',
		);
	});

	test('resolvePluginStylesPath throws when manifest dir is missing', () => {
		expect(() => resolvePluginStylesPath(manifest())).toThrow(/plugin directory/i);
	});

	test('findPluginStyleElement locates style by plugin id', () => {
		const doc = createStyleDocument();
		const style = doc.createElement('style');
		style.id = PLUGIN_ID;
		doc.head.appendChild(style);

		expect(findPluginStyleElement(PLUGIN_ID, doc)).toBe(style);
	});

	test('findPluginStyleElement falls back to data-name selector', () => {
		const doc = createStyleDocument();
		const style = doc.createElement('style');
		style.setAttribute('data-name', PLUGIN_ID);
		doc.head.appendChild(style);

		expect(findPluginStyleElement(PLUGIN_ID, doc)).toBe(style);
	});

	test('applyPluginStylesToHead updates an existing style element', () => {
		const doc = createStyleDocument();
		const style = doc.createElement('style');
		style.id = PLUGIN_ID;
		style.textContent = '.old { color: red; }';
		doc.head.appendChild(style);

		applyPluginStylesToHead(PLUGIN_ID, '.new { color: blue; }', doc);

		expect(style.textContent).toBe('.new { color: blue; }');
	});

	test('applyPluginStylesToHead creates a style element when missing', () => {
		const doc = createStyleDocument();

		applyPluginStylesToHead(PLUGIN_ID, '.created { color: green; }', doc);

		const style = doc.getElementById(PLUGIN_ID);
		expect(style).not.toBeNull();
		expect(style?.textContent).toBe('.created { color: green; }');
	});

	test('reloadPluginCss reads styles.css and applies it to the document head', async () => {
		const doc = createStyleDocument();
		const css = '.anki-test-reload { opacity: 1; }';
		const plugin = {
			manifest: manifest('.obsidian/plugins/obsidian-anki-ast-sync'),
			app: {
				vault: {
					adapter: {
						exists: async (path: string) =>
							path === '.obsidian/plugins/obsidian-anki-ast-sync/styles.css',
						read: async (path: string) => {
							if (path !== '.obsidian/plugins/obsidian-anki-ast-sync/styles.css') {
								throw new Error(`unexpected path: ${path}`);
							}
							return css;
						},
					},
				},
			},
		};

		const result = await reloadPluginCss(plugin as never, doc);

		expect(result.ok).toBe(true);
		expect(doc.getElementById(PLUGIN_ID)?.textContent).toBe(css);
	});

	test('reloadPluginCss returns error when styles.css is missing', async () => {
		const doc = createStyleDocument();
		const plugin = {
			manifest: manifest('.obsidian/plugins/obsidian-anki-ast-sync'),
			app: {
				vault: {
					adapter: {
						exists: async () => false,
						read: async () => {
							throw new Error('should not read');
						},
					},
				},
			},
		};

		const result = await reloadPluginCss(plugin as never, doc);

		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/styles\.css/i);
	});
});
