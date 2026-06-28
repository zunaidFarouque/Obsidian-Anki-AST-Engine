export type VaultFileStat = {
  size: number;
  isFile: boolean;
};

export interface VaultAdapter {
  readonly vaultRoot: string;
  listMarkdownFiles(scanFolders: string[]): Promise<string[]>;
  listAllFiles(): Promise<string[]>;
  readText(vaultRelativePath: string): Promise<string>;
  writeText(vaultRelativePath: string, content: string): Promise<void>;
  readBytes(vaultRelativePath: string): Promise<Uint8Array>;
  stat(vaultRelativePath: string): Promise<VaultFileStat>;
}

export function toActionFilePath(
  vault: VaultAdapter,
  vaultRelativePath: string,
): string {
  if (!vault.vaultRoot) {
    return vaultRelativePath.replace(/\\/g, "/");
  }

  return resolveActionPath(vault.vaultRoot, vaultRelativePath);
}

function resolveActionPath(vaultRoot: string, vaultRelativePath: string): string {
  const root = vaultRoot.replace(/\\/g, "/").replace(/\/$/, "");
  const relative = vaultRelativePath.replace(/\\/g, "/");
  return `${root}/${relative}`;
}

export { resolveActionPath };
