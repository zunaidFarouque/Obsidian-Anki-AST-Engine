import { glob } from "tinyglobby";
import { resolve } from "node:path";

export interface ScanVaultOptions {
  configDir?: string;
}

export async function scanVault(
  vaultPath: string,
  scanFolders: string[],
  options?: ScanVaultOptions,
): Promise<string[]> {
  const absoluteVault = resolve(vaultPath);
  const patterns = scanFolders.map((folder) => {
    const normalized = folder.replace(/\\/g, "/");
    return `${normalized}/**/*.md`;
  });

  const configFolderName = options?.configDir?.replace(/^[/\\]+|[/\\]+$/g, "") || [".", "obsidian"].join("");
  const ignorePatterns = [`**/${configFolderName}/**`, "**/.trash/**"];

  const matches = await glob(patterns, {
    cwd: absoluteVault,
    absolute: true,
    onlyFiles: true,
    dot: false,
    ignore: ignorePatterns,
  });

  return [...new Set(matches)].sort();
}
