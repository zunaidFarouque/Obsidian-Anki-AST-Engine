import type { App } from 'obsidian';

function normalizePath(path: string): string {
	return path.replace(/\\/g, '/');
}

function toVaultRelativePath(app: App, filePath: string): string {
	const normalized = normalizePath(filePath);
	const vaultRoot = normalizePath(
		'getBasePath' in app.vault.adapter &&
			typeof app.vault.adapter.getBasePath === 'function'
			? app.vault.adapter.getBasePath()
			: '',
	);

	if (!vaultRoot) {
		return normalized;
	}

	const rootWithSlash = vaultRoot.endsWith('/') ? vaultRoot : `${vaultRoot}/`;
	if (normalized.startsWith(rootWithSlash)) {
		return normalized.slice(rootWithSlash.length);
	}

	return normalized;
}

function headingAnchorFromTag(tag: string): string | undefined {
	const segments = tag.split('::').map((segment) => segment.trim());
	const heading = segments.at(-1);
	return heading && heading.length > 0 ? heading : undefined;
}

export async function openVaultCard(
	app: App,
	file: string,
	tag: string,
): Promise<void> {
	const relativePath = toVaultRelativePath(app, file);
	const heading = headingAnchorFromTag(tag);
	const linkTarget = heading ? `${relativePath}#${heading}` : relativePath;

	await app.workspace.openLinkText(linkTarget, '', false, { active: true });
}
