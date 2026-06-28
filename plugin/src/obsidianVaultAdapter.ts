import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import type { VaultAdapter } from 'obsidian-anki-ast-engine/vault';

function normalizeVaultPath(path: string): string {
	return path.replace(/\\/g, '/');
}

export function createObsidianVaultAdapter(app: App): VaultAdapter {
	const adapter = app.vault.adapter;
	const vaultRoot =
		'getBasePath' in adapter && typeof adapter.getBasePath === 'function'
			? adapter.getBasePath()
			: '';

	return {
		vaultRoot,

		async listMarkdownFiles(scanFolders: string[]): Promise<string[]> {
			const folders = scanFolders.length > 0 ? scanFolders : ['.'];
			const files = app.vault
				.getMarkdownFiles()
				.map((file) => normalizeVaultPath(file.path));

			return files
				.filter((path) =>
					folders.some((folder) => {
						if (folder === '.') {
							return true;
						}
						return path === folder || path.startsWith(`${folder}/`);
					}),
				)
				.sort();
		},

		async listAllFiles(): Promise<string[]> {
			return app.vault
				.getFiles()
				.map((file) => normalizeVaultPath(file.path))
				.sort();
		},

		async readText(vaultRelativePath: string): Promise<string> {
			const file = resolveVaultFile(app, vaultRelativePath);
			return app.vault.read(file);
		},

		async writeText(vaultRelativePath: string, content: string): Promise<void> {
			const file = resolveVaultFile(app, vaultRelativePath);
			await app.vault.modify(file, content);
		},

		async readBytes(vaultRelativePath: string): Promise<Uint8Array> {
			const normalized = normalizeVaultPath(vaultRelativePath);
			const binary = await adapter.readBinary(normalized);
			return binary instanceof Uint8Array ? binary : new Uint8Array(binary);
		},

		async stat(vaultRelativePath: string): Promise<{ size: number; isFile: boolean }> {
			const file = resolveVaultFile(app, vaultRelativePath);
			return {
				size: file.stat.size,
				isFile: true,
			};
		},
	};
}

function resolveVaultFile(app: App, vaultRelativePath: string): TFile {
	const normalized = normalizeVaultPath(vaultRelativePath);
	const file = app.vault.getAbstractFileByPath(normalized);
	if (!(file instanceof TFile)) {
		throw new Error(`Vault file not found: ${normalized}`);
	}
	return file;
}
