import { normalize, join } from "node:path";
import type { Content } from "mdast";
import type { VaultFileIndex, FileCache } from "./vaultIndex";
import { findBlockById, extractHeadingSection } from "../ast/blockIdTagging";

export type ParsedLinktext = {
  path: string;
  subpath?: string;
  displayText?: string;
  isEmbed: boolean;
};

export function parseLinktext(
  linktext: string,
  isEmbed: boolean,
): ParsedLinktext {
  let working = linktext.trim();
  let displayText: string | undefined;

  const pipeIndex = working.lastIndexOf("|");
  if (pipeIndex !== -1) {
    const hashIndex = working.indexOf("#");
    if (hashIndex === -1 || pipeIndex > hashIndex) {
      displayText = working.slice(pipeIndex + 1);
      working = working.slice(0, pipeIndex);
    }
  }

  const hashIndex = working.indexOf("#");
  if (hashIndex === -1) {
    return {
      path: working,
      displayText,
      isEmbed,
    };
  }

  return {
    path: working.slice(0, hashIndex),
    subpath: working.slice(hashIndex),
    displayText,
    isEmbed,
  };
}

export function getFirstLinkpathDest(
  linkpath: string,
  sourcePath: string,
  vaultIndex: VaultFileIndex,
): string | null {
  const normalizedSource = sourcePath.replace(/\\/g, "/");

  if (!linkpath || linkpath.startsWith("#")) {
    return normalizedSource;
  }

  let target = linkpath.replace(/\\/g, "/").trim();
  const sourceDir = normalizedSource.includes("/")
    ? normalizedSource.slice(0, normalizedSource.lastIndexOf("/"))
    : "";

  if (target.startsWith("./")) {
    target = normalize(join(sourceDir, target.slice(2))).replace(/\\/g, "/");
  } else if (target.startsWith("../")) {
    target = normalize(join(sourceDir, target)).replace(/\\/g, "/");
  } else if (!target.includes("/")) {
    const basenameMatches = findBasenameMatches(target, vaultIndex);
    if (basenameMatches.length === 1) {
      return basenameMatches[0]!;
    }

    if (basenameMatches.length > 1) {
      const localMatches = basenameMatches.filter(
        (match) =>
          sourceDir &&
          (match === sourceDir || match.startsWith(`${sourceDir}/`)),
      );
      if (localMatches.length === 1) {
        return localMatches[0]!;
      }
      return null;
    }

    return null;
  }

  if (!target.endsWith(".md") && vaultIndex.files.has(`${target}.md`)) {
    return `${target}.md`;
  }

  return vaultIndex.files.has(target) ? target : null;
}

function findBasenameMatches(
  linkpath: string,
  vaultIndex: VaultFileIndex,
): string[] {
  const withMd = linkpath.endsWith(".md") ? linkpath : `${linkpath}.md`;
  const direct = vaultIndex.byBasename.get(linkpath) ?? [];
  const mdMatches = vaultIndex.byBasename.get(withMd) ?? [];
  const mdBase = vaultIndex.byBasename.get(basenameNoExt(linkpath)) ?? [];

  return [...new Set([...direct, ...mdMatches, ...mdBase])].filter((path) =>
    path.endsWith(".md"),
  );
}

function basenameNoExt(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/i, "");
}

export function resolveSubpath(
  fileCache: FileCache,
  subpath: string,
): Content[] | null {
  if (!subpath.startsWith("#")) {
    return null;
  }

  const fragment = subpath.slice(1);
  if (fragment.startsWith("^")) {
    const blockId = fragment.slice(1);
    return findBlockById(fileCache.ast, blockId);
  }

  return extractHeadingSection(fileCache.ast, fragment);
}

export function formatWikilink(parsed: ParsedLinktext): string {
  const pathPart = `${parsed.path}${parsed.subpath ?? ""}`;
  const inner = parsed.displayText ? `${pathPart}|${parsed.displayText}` : pathPart;
  return parsed.isEmbed ? `![[${inner}]]` : `[[${inner}]]`;
}
