import fg from "fast-glob";
import { resolve, relative, basename, normalize, join } from "node:path";
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

const IMAGE_MEDIA_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
]);

export function isMediaPath(path: string): boolean {
  const lower = path.toLowerCase();
  for (const ext of MEDIA_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

export function isImageMediaPath(path: string): boolean {
  const lower = path.toLowerCase();
  for (const ext of IMAGE_MEDIA_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

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
    const basenameKeys =
      baseNoExt === base ? [base] : [base, baseNoExt];

    for (const key of basenameKeys) {
      const list = byBasename.get(key) ?? [];
      if (!list.includes(normalized)) {
        list.push(normalized);
        byBasename.set(key, list);
      }
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

export type AttachmentResolveOptions = {
  attachmentFolder?: string;
  linkFormat?: "shortest" | "relative" | "absolute";
};

function sourceDirectory(sourcePath: string): string {
  const normalizedSource = sourcePath.replace(/\\/g, "/");
  return normalizedSource.includes("/")
    ? normalizedSource.slice(0, normalizedSource.lastIndexOf("/"))
    : "";
}

function findImageBasenameMatches(
  fileName: string,
  vaultIndex: VaultFileIndex,
): string[] {
  const basenameKey = basename(fileName);
  return (vaultIndex.byBasename.get(basenameKey) ?? []).filter(
    (path) => vaultIndex.files.has(path) && isImageMediaPath(path),
  );
}

export function pickScopedAttachmentMatch(
  matches: string[],
  sourcePath: string,
  options: AttachmentResolveOptions = {},
): string | null {
  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return matches[0]!;
  }

  const sourceDir = sourceDirectory(sourcePath);
  const attachmentFolder = options.attachmentFolder ?? "attachments";

  const inSameDir = matches.filter((match) => {
    const matchDir = match.includes("/")
      ? match.slice(0, match.lastIndexOf("/"))
      : "";
    return matchDir === sourceDir;
  });
  if (inSameDir.length === 1) {
    return inSameDir[0]!;
  }

  const underSource = matches.filter(
    (match) => sourceDir.length > 0 && match.startsWith(`${sourceDir}/`),
  );
  if (underSource.length === 1) {
    return underSource[0]!;
  }

  const attachmentPrefixes = [
    sourceDir ? `${sourceDir}/${attachmentFolder}/` : null,
    `${attachmentFolder}/`,
  ].filter((value): value is string => Boolean(value));

  const inAttachmentFolder = matches.filter((match) =>
    attachmentPrefixes.some((prefix) => match.startsWith(prefix)),
  );
  if (inAttachmentFolder.length === 1) {
    return inAttachmentFolder[0]!;
  }

  if (underSource.length > 1) {
    const scopedPick = pickScopedAttachmentMatch(underSource, sourcePath, {
      ...options,
      attachmentFolder,
    });
    if (scopedPick) {
      return scopedPick;
    }
  }

  if (options.linkFormat === "shortest") {
    const sorted = [...matches].sort((left, right) => left.length - right.length);
    const shortest = sorted[0]!;
    if (sorted[1]!.length > shortest.length) {
      return shortest;
    }
  }

  return null;
}

export function resolveAttachmentPath(
  fileName: string,
  sourcePath: string,
  vaultIndex: VaultFileIndex,
  options: AttachmentResolveOptions = {},
): string | null {
  const sourceDir = sourceDirectory(sourcePath);
  let target = fileName.replace(/\\/g, "/").trim();
  if (target.length === 0) {
    return null;
  }

  if (target.startsWith("./")) {
    target = normalize(join(sourceDir, target.slice(2))).replace(/\\/g, "/");
  } else if (target.startsWith("../")) {
    target = normalize(join(sourceDir, target)).replace(/\\/g, "/");
  }

  const explicitCandidates = [
    target,
    sourceDir ? `${sourceDir}/${target}` : null,
    options.attachmentFolder ? `${options.attachmentFolder}/${target}` : null,
    sourceDir && options.attachmentFolder
      ? `${sourceDir}/${options.attachmentFolder}/${target}`
      : null,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of explicitCandidates) {
    if (vaultIndex.files.has(candidate)) {
      return candidate;
    }
  }

  if (target.includes("/")) {
    return null;
  }

  return pickScopedAttachmentMatch(
    findImageBasenameMatches(target, vaultIndex),
    sourcePath,
    options,
  );
}

export function vaultRelativePath(
  vaultPath: string,
  absolutePath: string,
): string {
  return relative(vaultPath, absolutePath).replace(/\\/g, "/");
}

export type { Content };
