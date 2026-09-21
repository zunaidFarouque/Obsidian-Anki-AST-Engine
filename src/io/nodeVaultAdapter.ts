import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve as nodeResolve } from "node:path";
import type { VaultAdapter, VaultFileStat } from "./vaultAdapter";
import { basename, relativePath } from "../utils/pathUtils";
import { scanVault } from "./scanner";

export interface NodeVaultAdapterOptions {
  configDir?: string;
}

export function createNodeVaultAdapter(
  vaultPath: string,
  options?: NodeVaultAdapterOptions,
): VaultAdapter {
  const vaultRoot = nodeResolve(vaultPath);
  const configFolderName = options?.configDir?.replace(/^[/\\]+|[/\\]+$/g, "") || [".", "obsidian"].join("");

  return {
    vaultRoot,

    async listMarkdownFiles(scanFolders: string[]): Promise<string[]> {
      const absolutePaths = await scanVault(vaultRoot, scanFolders, options);
      return absolutePaths.map((absolutePath) =>
        relativePath(vaultRoot, absolutePath),
      );
    },

    async listAllFiles(): Promise<string[]> {
      const { glob } = await import("tinyglobby");
      const matches = await glob("**/*", {
        cwd: vaultRoot,
        onlyFiles: true,
        dot: false,
        ignore: [`**/${configFolderName}/**`, "**/.trash/**"],
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
