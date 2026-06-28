import type { VaultAdapter, VaultFileStat } from "./vaultAdapter";
import { basename, joinPath } from "../utils/pathUtils";

type StoredFile = {
  text?: string;
  bytes?: Uint8Array;
};

export class InMemoryVaultAdapter implements VaultAdapter {
  readonly vaultRoot: string;
  private readonly files = new Map<string, StoredFile>();

  constructor(vaultRoot = "/vault", seed?: Record<string, string | Uint8Array>) {
    this.vaultRoot = vaultRoot;
    if (seed) {
      for (const [path, content] of Object.entries(seed)) {
        this.put(path, content);
      }
    }
  }

  put(vaultRelativePath: string, content: string | Uint8Array): void {
    const normalized = this.normalizePath(vaultRelativePath);
    if (typeof content === "string") {
      this.files.set(normalized, { text: content });
      return;
    }

    this.files.set(normalized, { bytes: content });
  }

  getText(vaultRelativePath: string): string | undefined {
    return this.files.get(this.normalizePath(vaultRelativePath))?.text;
  }

  async listMarkdownFiles(scanFolders: string[]): Promise<string[]> {
    const folders = scanFolders.length > 0 ? scanFolders : ["."];
    const markdownFiles = [...this.files.keys()].filter((path) =>
      path.endsWith(".md"),
    );

    return markdownFiles
      .filter((path) =>
        folders.some((folder) => {
          const normalizedFolder = this.normalizePath(folder);
          if (normalizedFolder === ".") {
            return true;
          }
          return (
            path === normalizedFolder ||
            path.startsWith(`${normalizedFolder}/`)
          );
        }),
      )
      .sort();
  }

  async listAllFiles(): Promise<string[]> {
    return [...this.files.keys()].sort();
  }

  async readText(vaultRelativePath: string): Promise<string> {
    const stored = this.files.get(this.normalizePath(vaultRelativePath));
    if (!stored?.text) {
      throw new Error(`Missing text file: ${vaultRelativePath}`);
    }
    return stored.text;
  }

  async writeText(vaultRelativePath: string, content: string): Promise<void> {
    this.put(vaultRelativePath, content);
  }

  async readBytes(vaultRelativePath: string): Promise<Uint8Array> {
    const stored = this.files.get(this.normalizePath(vaultRelativePath));
    if (stored?.bytes) {
      return stored.bytes;
    }
    if (stored?.text) {
      return new TextEncoder().encode(stored.text);
    }
    throw new Error(`Missing file bytes: ${vaultRelativePath}`);
  }

  async stat(vaultRelativePath: string): Promise<VaultFileStat> {
    const stored = this.files.get(this.normalizePath(vaultRelativePath));
    if (!stored) {
      throw new Error(`Missing file: ${vaultRelativePath}`);
    }

    const size = stored.bytes
      ? stored.bytes.byteLength
      : new TextEncoder().encode(stored.text ?? "").byteLength;

    return { size, isFile: true };
  }

  private normalizePath(path: string): string {
    return joinPath(path);
  }
}

export function seedVaultFromPaths(
  vaultRoot: string,
  entries: Record<string, string>,
): InMemoryVaultAdapter {
  const adapter = new InMemoryVaultAdapter(vaultRoot);
  for (const [path, text] of Object.entries(entries)) {
    adapter.put(path, text);
  }
  return adapter;
}
