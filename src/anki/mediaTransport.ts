import { basename } from "node:path";
import { createHash } from "node:crypto";
import { toAnkiMediaFileName } from "./mediaFileName";
import { insertHashBeforeExtension, MEDIA_HASH_LENGTH } from "./mediaNaming";

const REMOTE_URL_PATTERN = /^https?:\/\//i;

export function isRemoteMediaUrl(url: string): boolean {
  return REMOTE_URL_PATTERN.test(url.trim());
}

export function hashRemoteUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, MEDIA_HASH_LENGTH);
}

export function fileNameFromRemoteUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return toAnkiMediaFileName(`remote_${hashRemoteUrl(url)}.png`);
  }

  const pathBase = basename(decodeURIComponent(parsed.pathname));
  if (!pathBase || pathBase === "/" || pathBase === ".") {
    return toAnkiMediaFileName(`remote_${hashRemoteUrl(url)}.png`);
  }

  if (!pathBase.includes(".")) {
    return toAnkiMediaFileName(`${pathBase}.png`);
  }

  return toAnkiMediaFileName(pathBase);
}

export function disambiguateRemoteFileName(
  fileName: string,
  sourceUrl: string,
  seen: Map<string, string>,
): string {
  const existing = seen.get(fileName);
  if (!existing) {
    seen.set(fileName, sourceUrl);
    return fileName;
  }

  if (existing === sourceUrl) {
    return fileName;
  }

  const disambiguated = insertHashBeforeExtension(fileName, hashRemoteUrl(sourceUrl));
  seen.set(disambiguated, sourceUrl);
  return disambiguated;
}
