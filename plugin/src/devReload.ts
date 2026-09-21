import type { Plugin, PluginManifest } from 'obsidian';

export type DevReloadResult = {
	ok: boolean;
	message: string;
};

export type StyleDocument = {
	getElementById(id: string): HTMLElement | null;
	querySelector(selector: string): Element | null;
	createElement(tagName: string): HTMLElement;
	head: {
		appendChild(node: HTMLElement): void;
	};
};

function resolveStyleDocument(doc?: StyleDocument): StyleDocument {
	return doc ?? activeDocument;
}

export function resolvePluginStylesPath(manifest: PluginManifest): string {
	const dir = manifest.dir?.trim();
	if (!dir) {
		throw new Error('Plugin directory is unknown; cannot resolve styles.css path.');
	}
	return `${dir}/styles.css`;
}

export function findPluginStyleElement(
	pluginId: string,
	doc?: StyleDocument,
): HTMLStyleElement | null {
	const root = resolveStyleDocument(doc);
	return (
		(root.getElementById(pluginId) as HTMLStyleElement | null) ??
		(root.querySelector(`style[data-name="${pluginId}"]`) as HTMLStyleElement | null) ??
		(root.getElementById(`plugin-${pluginId}`) as HTMLStyleElement | null)
	);
}

export function applyPluginStylesToHead(
	pluginId: string,
	css: string,
	doc?: StyleDocument,
): void {
	const root = resolveStyleDocument(doc);
	const existing = findPluginStyleElement(pluginId, root);
	if (existing) {
		existing.textContent = css;
		return;
	}

	const style = root.createElement('style');
	style.id = pluginId;
	style.textContent = css;
	root.head.appendChild(style);
}

export async function reloadPluginCss(
	plugin: Plugin,
	doc?: StyleDocument,
): Promise<DevReloadResult> {
	try {
		const stylesPath = resolvePluginStylesPath(plugin.manifest);
		const exists = await plugin.app.vault.adapter.exists(stylesPath);
		if (!exists) {
			return { ok: false, message: `styles.css not found at ${stylesPath}` };
		}

		const css = await plugin.app.vault.adapter.read(stylesPath);
		applyPluginStylesToHead(plugin.manifest.id, css, doc);
		return { ok: true, message: 'Plugin CSS reloaded.' };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, message: `Failed to reload CSS: ${message}` };
	}
}
