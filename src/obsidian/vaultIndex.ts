import fg from "fast-glob";
import { resolve, relative, basename } from "node:path";
import { readFile } from "node:fs/promises";
import type { Root, Heading } from "mdast";
import type { Content } from "mdast";
import { parseMarkdown } from "../ast/processor";
import { buildBlockIndex, type BlockCacheEntry } from "../ast/blockIdTagging";
import { stripFrontmatter } from "../io/frontmatterFilter";

export type FileCache = {
  path: string;
  ast: Root;
  headings: HeadingEntry[];
  blocks: BlockCacheEntry[];
};

export type HeadingEntry = {
  heading: string;
  depth: number;
  index: number;
};

export type VaultFileIndex = {
  vaultPath: string;
  files: Set<string>;
  byBasename: Map<string, string[]>;
  fileCaches: Map<string, FileCache>;
};

const MEDIA_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
  ".mp3",
  ".mp4",
]);

export async function buildVaultFileIndex(
  vaultPath: string,
): Promise<VaultFileIndex> {
  const absoluteVault = resolve(vaultPath);
  const matches = await fg("**/*", {
    cwd: absoluteVault,
    onlyFiles: true,
    dot: false,
    ignore: ["**/.obsidian/**", "**/.trash/**"],
  });

  const files = new Set<string>();
  const byBasename = new Map<string, string[]>();
  const fileCaches = new Map<string, FileCache>();

  for (const match of matches) {
    const normalized = match.replace(/\\/g, "/");
    files.add(normalized);

    const base = basename(normalized);
    const baseNoExt = base.replace(/\.md$/i, "");
    for (const key of [base, baseNoExt]) {
      const list = byBasename.get(key) ?? [];
      list.push(normalized);
      byBasename.set(key, list);
    }

    if (!normalized.endsWith(".md")) {
      continue;
    }

    const rawText = await readFile(resolve(absoluteVault, normalized), "utf8");
    const body = stripFrontmatter(rawText);
    const ast = parseMarkdown(body, absoluteVault);
    const headings = indexHeadings(ast);
    const blocks = buildBlockIndex(ast);

    fileCaches.set(normalized, {
      path: normalized,
      ast,
      headings,
      blocks,
    });
  }

  return {
    vaultPath: absoluteVault,
    files,
    byBasename,
    fileCaches,
  };
}

function indexHeadings(ast: Root): HeadingEntry[] {
  const headings: HeadingEntry[] = [];

  ast.children.forEach((node, index) => {
    if (node.type !== "heading") {
      return;
    }

    const heading = node as Heading;
    const text = heading.children
      .map((child) => ("value" in child ? String(child.value) : ""))
      .join("")
      .trim();

    headings.push({
      heading: text,
      depth: heading.depth,
      index,
    });
  });

  return headings;
}

export function isMediaPath(path: string): boolean {
  const lower = path.toLowerCase();
  for (const ext of MEDIA_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

export function resolveAttachmentPath(
  fileName: string,
  sourcePath: string,
  vaultIndex: VaultFileIndex,
  attachmentFolder?: string,
): string | null {
  const normalizedSource = sourcePath.replace(/\\/g, "/");
  const sourceDir = normalizedSource.includes("/")
    ? normalizedSource.slice(0, normalizedSource.lastIndexOf("/"))
    : "";

  const candidates = [
    sourceDir ? `${sourceDir}/${fileName}` : fileName,
    fileName,
    attachmentFolder ? `${attachmentFolder}/${fileName}` : null,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const normalized = candidate.replace(/\\/g, "/");
    if (vaultIndex.files.has(normalized)) {
      return normalized;
    }
  }

  const basenameOnly = basename(fileName);
  const matches = vaultIndex.byBasename.get(basenameOnly) ?? [];
  if (matches.length === 1) {
    return matches[0]!;
  }

  return null;
}

export function vaultRelativePath(
  vaultPath: string,
  absolutePath: string,
): string {
  return relative(vaultPath, absolutePath).replace(/\\/g, "/");
}

export type { Content };
