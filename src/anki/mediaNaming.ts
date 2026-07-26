import { readFile } from "node:fs/promises";
import pLimit from "p-limit";
import { toAnkiMediaFileName } from "./mediaFileName";
import type { VaultAdapter } from "../io/vaultAdapter";
import { basename as pathBasename } from "../utils/pathUtils";

export const MEDIA_HASH_SEPARATOR = "_=_";
export const MEDIA_HASH_LENGTH = 8;

export type MediaBasenameWarning = {
  kind: "media_basename_disambiguated";
  basename: string;
  message: string;
  sources: Array<{ vaultRelativePath: string; ankiFileName: string }>;
};

export type MediaNameAssignment = {
  vaultRelativePath: string;
  absolutePath: string;
  ankiFileName: string;
  disambiguated: boolean;
};

export type MediaNameMapResult = {
  nameByVaultPath: Map<string, string>;
  assignments: MediaNameAssignment[];
  warnings: MediaBasenameWarning[];
};

export type MediaPathEntry = {
  vaultRelativePath: string;
  absolutePath: string;
};

export function insertHashBeforeExtension(baseName: string, hash: string): string {
  const lastDot = baseName.lastIndexOf(".");
  if (lastDot <= 0) {
    return `${baseName}${MEDIA_HASH_SEPARATOR}${hash}`;
  }

  const stem = baseName.slice(0, lastDot);
  const ext = baseName.slice(lastDot);
  return `${stem}${MEDIA_HASH_SEPARATOR}${hash}${ext}`;
}

export async function hashFileContent(buffer: Uint8Array): Promise<string> {
  const normalizedBuffer = new Uint8Array(buffer.byteLength);
  normalizedBuffer.set(buffer);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    normalizedBuffer,
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, MEDIA_HASH_LENGTH);
}

async function readEntryBytes(
  entry: MediaPathEntry,
  vault?: VaultAdapter,
): Promise<Uint8Array> {
  if (vault) {
    return vault.readBytes(entry.vaultRelativePath);
  }

  const buffer = await readFile(entry.absolutePath);
  return new Uint8Array(buffer);
}

export async function buildAnkiMediaNameMap(
  entries: MediaPathEntry[],
  vault?: VaultAdapter,
): Promise<MediaNameMapResult> {
  const uniqueEntries = dedupeEntries(entries);
  const groups = new Map<string, MediaPathEntry[]>();

  for (const entry of uniqueEntries) {
    const vaultBaseName = pathBasename(entry.vaultRelativePath);
    const sanitizedBasename = toAnkiMediaFileName(vaultBaseName);
    const group = groups.get(sanitizedBasename) ?? [];
    group.push(entry);
    groups.set(sanitizedBasename, group);
  }

  const nameByVaultPath = new Map<string, string>();
  const assignments: MediaNameAssignment[] = [];
  const warnings: MediaBasenameWarning[] = [];
  const limit = pLimit(4);

  for (const [sanitizedBasename, group] of groups) {
    if (group.length === 1) {
      const entry = group[0]!;
      nameByVaultPath.set(entry.vaultRelativePath, sanitizedBasename);
      assignments.push({
        vaultRelativePath: entry.vaultRelativePath,
        absolutePath: entry.absolutePath,
        ankiFileName: sanitizedBasename,
        disambiguated: false,
      });
      continue;
    }

    const hashedEntries = await Promise.all(
      group.map((entry) =>
        limit(async () => {
          const buffer = await readEntryBytes(entry, vault);
          const hash = await hashFileContent(buffer);
          const ankiFileName = insertHashBeforeExtension(sanitizedBasename, hash);
          return { entry, ankiFileName };
        }),
      ),
    );

    const warningSources: MediaBasenameWarning["sources"] = [];

    for (const { entry, ankiFileName } of hashedEntries) {
      nameByVaultPath.set(entry.vaultRelativePath, ankiFileName);
      assignments.push({
        vaultRelativePath: entry.vaultRelativePath,
        absolutePath: entry.absolutePath,
        ankiFileName,
        disambiguated: true,
      });
      warningSources.push({
        vaultRelativePath: entry.vaultRelativePath,
        ankiFileName,
      });
    }

    const pathList = warningSources
      .map((source) => `${source.vaultRelativePath} → ${source.ankiFileName}`)
      .join("; ");
    warnings.push({
      kind: "media_basename_disambiguated",
      basename: sanitizedBasename,
      message: `Multiple vault files share basename "${sanitizedBasename}". Disambiguated with content hash: ${pathList}`,
      sources: warningSources,
    });
  }

  return { nameByVaultPath, assignments, warnings };
}

function dedupeEntries(entries: MediaPathEntry[]): MediaPathEntry[] {
  const seen = new Set<string>();
  const unique: MediaPathEntry[] = [];

  for (const entry of entries) {
    if (seen.has(entry.vaultRelativePath)) {
      continue;
    }
    seen.add(entry.vaultRelativePath);
    unique.push(entry);
  }

  return unique;
}
