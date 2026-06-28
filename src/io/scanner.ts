import fg from "fast-glob";
import { resolve } from "node:path";

export async function scanVault(
  vaultPath: string,
  scanFolders: string[],
): Promise<string[]> {
  const absoluteVault = resolve(vaultPath);
  const patterns = scanFolders.map((folder) => {
    const normalized = folder.replace(/\\/g, "/");
    return `${normalized}/**/*.md`;
  });

  const matches = await fg(patterns, {
    cwd: absoluteVault,
    absolute: true,
    onlyFiles: true,
    dot: false,
    ignore: ["**/.obsidian/**", "**/.trash/**"],
  });

  return [...new Set(matches)].sort();
}
