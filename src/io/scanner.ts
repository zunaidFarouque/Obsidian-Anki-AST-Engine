import fg from "fast-glob";
import { resolve } from "node:path";
import type { DeckMapping } from "../config/configParser";

export async function scanVault(
  vaultPath: string,
  deckMappings: DeckMapping[],
): Promise<string[]> {
  const absoluteVault = resolve(vaultPath);
  const patterns = deckMappings.map((mapping) => {
    const folder = mapping.obsidianFolder.replace(/\\/g, "/");
    return `${folder}/**/*.md`;
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
