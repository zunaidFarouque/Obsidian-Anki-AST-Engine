import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve as nodeResolve } from "node:path";
import type { VaultAdapter, VaultFileStat } from "./vaultAdapter";
import { basename, relativePath } from "../utils/pathUtils";
import { scanVault } from "./scanner";

export function createNodeVaultAdapter(vaultPath: string): VaultAdapter {
  const vaultRoot = nodeResolve(vaultPath);

  return {
    vaultRoot,

    async listMarkdownFiles(scanFolders: string[]): Promise<string[]> {
      const absolutePaths = await scanVault(vaultRoot, scanFolders);
      return absolutePaths.map((absolutePath) =>
        relativePath(vaultRoot, absolutePath),
      );
    },

    async listAllFiles(): Promise<string[]> {
      const { default: fg } = await import("fast-glob");
      const matches = await fg("**/*", {
        cwd: vaultRoot,
        onlyFiles: true,
        dot: false,
        ignore: ["**/.obsidian/**", "**/.trash/**"],
      });
      return matches.map((match) => match.replace(/\\/g, "/")).sort();
    },

    async readText(vaultRelativePath: string): Promise<string> {
      return readFile(
        nodeResolve(vaultRoot, vaultRelativePath),
        "utf8",
      );
    },

    async writeText(vaultRelativePath: string, content: string): Promise<void> {
      await writeFile(
        nodeResolve(vaultRoot, vaultRelativePath),
        content,
        "utf8",
      );
    },

    async readBytes(vaultRelativePath: string): Promise<Uint8Array> {
      const buffer = await readFile(nodeResolve(vaultRoot, vaultRelativePath));
      return new Uint8Array(buffer);
    },

    async stat(vaultRelativePath: string): Promise<VaultFileStat> {
      const fileStat = await stat(nodeResolve(vaultRoot, vaultRelativePath));
      return {
        size: fileStat.size,
        isFile: fileStat.isFile(),
      };
    },
  };
}

export { basename };
