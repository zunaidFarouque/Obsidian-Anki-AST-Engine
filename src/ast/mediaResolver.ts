import { resolve as resolvePath } from "node:path";
import type { Content, Image, Link, Paragraph, Root } from "mdast";
import { isObsidianEmbed } from "./obsidianLinks";
import { formatWikilink, parseLinktext, type ParsedLinktext } from "../obsidian/linkResolver";
import {
  getMediaKind,
  isAttachableMediaPath,
  isMediaPath,
  resolveAttachmentPath,
  type VaultFileIndex,
} from "../obsidian/vaultIndex";
import { enqueueMediaDryRun } from "../anki/mediaQueue";
import { toAnkiMediaFileName } from "../anki/mediaFileName";
import {
  disambiguateRemoteFileName,
  fileNameFromRemoteUrl,
  isRemoteMediaUrl,
} from "../anki/mediaTransport";
import type { MediaPathEntry } from "../anki/mediaNaming";
import {
  createResolvedMediaNode,
  isPdfLinkParagraph,
  isSoundMediaParagraph,
  soundFileNameFromParagraph,
} from "./vaultMediaNodes";

export type MediaUploadTransport = "path" | "base64" | "url";

export type MediaUploadPlan = {
  fileName: string;
  transport: MediaUploadTransport;
  absolutePath?: string;
  vaultRelativePath?: string;
  sourceUrl?: string;
};

export type MediaResolveResult = {
  plans: MediaUploadPlan[];
};

export type MediaResolveContext = {
  vaultPath: string;
  sourcePath: string;
  vaultIndex: VaultFileIndex;
  attachmentFolder?: string;
  linkFormat?: "shortest" | "relative" | "absolute";
  ankiNameByVaultPath?: Map<string, string>;
  dryRun: boolean;
  forceBase64Media?: boolean;
};

const WIKI_EMBED_IN_TEXT = /!\[\[([^\]]+)\]\]/g;

function attachmentOptions(context: Pick<
  MediaResolveContext,
  "attachmentFolder" | "linkFormat"
>) {
  return {
    attachmentFolder: context.attachmentFolder,
    linkFormat: context.linkFormat,
  };
}

function resolveVaultPath(
  mediaPath: string,
  context: Pick<
    MediaResolveContext,
    "sourcePath" | "vaultIndex" | "attachmentFolder" | "linkFormat"
  >,
): string | null {
  return resolveAttachmentPath(
    mediaPath,
    context.sourcePath,
    context.vaultIndex,
    attachmentOptions(context),
  );
}

function ankiFileNameForVaultPath(
  vaultRelativePath: string,
  context: MediaResolveContext,
): string {
  const fromMap = context.ankiNameByVaultPath?.get(vaultRelativePath);
  if (fromMap) {
    return fromMap;
  }

  const vaultBaseName = vaultRelativePath.split("/").pop() ?? vaultRelativePath;
  return toAnkiMediaFileName(vaultBaseName);
}

function isAttachableWikiEmbed(parsed: ParsedLinktext): boolean {
  return isAttachableMediaPath(parsed.path) && !parsed.subpath;
}

export function collectResolvedMediaPaths(
  ast: Root,
  context: Omit<MediaResolveContext, "dryRun" | "ankiNameByVaultPath">,
): MediaPathEntry[] {
  const entries: MediaPathEntry[] = [];
  const seen = new Set<string>();

  const addResolved = (vaultRelativePath: string) => {
    if (seen.has(vaultRelativePath)) {
      return;
    }

    seen.add(vaultRelativePath);
    entries.push({
      vaultRelativePath,
      absolutePath: resolvePath(context.vaultIndex.vaultPath, vaultRelativePath),
    });
  };

  const tryAddPath = (mediaPath: string) => {
    const resolved = resolveVaultPath(mediaPath, context);
    if (resolved) {
      addResolved(resolved);
    }
  };

  const walk = (nodes: Content[]) => {
    for (const node of nodes) {
      if (node.type === "image") {
        if (isRemoteMediaUrl(node.url)) {
          continue;
        }
        tryAddPath(node.url);
        continue;
      }

      if (isObsidianEmbed(node) && isAttachableWikiEmbed(node.data)) {
        tryAddPath(node.data.path);
        continue;
      }

      if (node.type === "paragraph") {
        const paragraph = node as Paragraph;
        collectWikiMediaFromParagraph(paragraph, tryAddPath);
        collectResolvedMediaFromParagraph(paragraph, tryAddPath);
      }

      if ("children" in node && Array.isArray(node.children)) {
        walk(node.children as Content[]);
      }
    }
  };

  walk(ast.children);
  return entries;
}

function collectResolvedMediaFromParagraph(
  paragraph: Paragraph,
  tryAddPath: (mediaPath: string) => void,
): void {
  if (isSoundMediaParagraph(paragraph)) {
    const fileName = soundFileNameFromParagraph(paragraph);
    if (fileName) {
      tryAddPath(fileName);
    }
    return;
  }

  if (!isPdfLinkParagraph(paragraph)) {
    return;
  }

  const link = paragraph.children[0] as Link;
  tryAddPath(link.url);
}

function collectWikiMediaFromParagraph(
  paragraph: Paragraph,
  tryAddPath: (mediaPath: string) => void,
): void {
  const fullText = paragraph.children
    .map((child) => ("value" in child ? String(child.value) : ""))
    .join("");

  if (!fullText.includes("![[")) {
    return;
  }

  for (const match of fullText.matchAll(WIKI_EMBED_IN_TEXT)) {
    const parsed = parseLinktext(match[1] ?? "", true);
    if (!isAttachableWikiEmbed(parsed)) {
      continue;
    }
    tryAddPath(parsed.path);
  }
}

export async function resolveMedia(
  ast: Root,
  context: MediaResolveContext,
): Promise<MediaResolveResult> {
  rewriteRemainingMediaEmbeds(ast.children, context);

  const plans: MediaUploadPlan[] = [];
  const seenPaths = new Set<string>();
  const seenRemoteNames = new Map<string, string>();

  visitResolvableMedia(ast, context, {
    onVaultPath: (vaultRelativePath, applyAnkiFileName) => {
      const absolutePath = resolvePath(context.vaultIndex.vaultPath, vaultRelativePath);
      const fileName = ankiFileNameForVaultPath(vaultRelativePath, context);
      applyAnkiFileName(fileName);
      addPathPlan(
        plans,
        seenPaths,
        fileName,
        absolutePath,
        vaultRelativePath,
        context.dryRun,
        context.forceBase64Media,
      );
    },
    onRemoteUrl: (sourceUrl, applyAnkiFileName) => {
      const baseName = fileNameFromRemoteUrl(sourceUrl);
      const fileName = disambiguateRemoteFileName(baseName, sourceUrl, seenRemoteNames);
      applyAnkiFileName(fileName);
      addUrlPlan(plans, fileName, sourceUrl, context.dryRun);
    },
  });

  return { plans };
}

function visitResolvableMedia(
  ast: Root,
  context: Pick<
    MediaResolveContext,
    "sourcePath" | "vaultIndex" | "attachmentFolder" | "linkFormat"
  >,
  handlers: {
    onVaultPath: (
      vaultRelativePath: string,
      applyAnkiFileName: (fileName: string) => void,
    ) => void;
    onRemoteUrl: (
      sourceUrl: string,
      applyAnkiFileName: (fileName: string) => void,
    ) => void;
  },
): void {
  const walk = (nodes: Content[]) => {
    for (const node of nodes) {
      if (node.type === "image") {
        if (isRemoteMediaUrl(node.url)) {
          handlers.onRemoteUrl(node.url, (fileName) => {
            node.url = fileName;
          });
          continue;
        }

        visitMediaReference(node.url, (resolved) => {
          handlers.onVaultPath(resolved, (fileName) => {
            node.url = fileName;
          });
        });
        continue;
      }

      if (node.type === "paragraph") {
        const paragraph = node as Paragraph;

        if (isSoundMediaParagraph(paragraph)) {
          const soundFile = soundFileNameFromParagraph(paragraph);
          if (soundFile) {
            visitMediaReference(soundFile, (resolved) => {
              handlers.onVaultPath(resolved, (fileName) => {
                const child = paragraph.children[0];
                if (child?.type === "text") {
                  child.value = `[sound:${fileName}]`;
                }
              });
            });
          }
          continue;
        }

        if (isPdfLinkParagraph(paragraph)) {
          const link = paragraph.children[0] as Link;
          visitMediaReference(link.url, (resolved) => {
            handlers.onVaultPath(resolved, (fileName) => {
              link.url = fileName;
            });
          });
          continue;
        }
      }

      if ("children" in node && Array.isArray(node.children)) {
        walk(node.children as Content[]);
      }
    }
  };

  function visitMediaReference(
    mediaPath: string,
    onResolvedVaultPath: (vaultRelativePath: string) => void,
  ): void {
    const resolved = resolveVaultPath(mediaPath, context);
    if (resolved) {
      onResolvedVaultPath(resolved);
    }
  }

  walk(ast.children);
}

function rewriteRemainingMediaEmbeds(
  children: Content[],
  context: MediaResolveContext,
): void {
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!child) {
      continue;
    }

    if (isObsidianEmbed(child) && isAttachableWikiEmbed(child.data)) {
      const mediaNode = createMediaNodeFromParsed(child.data, context);
      if (mediaNode) {
        children[index] = mediaNode;
      }
      continue;
    }

    if (child.type === "paragraph") {
      const replacement = rewriteParagraphMediaEmbeds(child as Paragraph, context);
      if (replacement) {
        children.splice(index, 1, ...replacement);
        index += replacement.length - 1;
      }
      continue;
    }

    if ("children" in child && Array.isArray(child.children)) {
      rewriteRemainingMediaEmbeds(child.children as Content[], context);
    }
  }
}

function rewriteParagraphMediaEmbeds(
  paragraph: Paragraph,
  context: MediaResolveContext,
): Content[] | undefined {
  const fullText = paragraph.children
    .map((child) => ("value" in child ? String(child.value) : ""))
    .join("");

  if (!fullText.includes("![[")) {
    return undefined;
  }

  const nodes: Content[] = [];
  let lastIndex = 0;
  let changed = false;

  for (const match of fullText.matchAll(WIKI_EMBED_IN_TEXT)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const parsed = parseLinktext(match[1] ?? "", true);

    if (!isAttachableWikiEmbed(parsed)) {
      continue;
    }

    changed = true;
    const before = fullText.slice(lastIndex, start).trim();
    if (before.length > 0) {
      nodes.push(createTextParagraph(before));
    }

    const mediaNode = createMediaNodeFromParsed(parsed, context);
    if (mediaNode) {
      nodes.push(mediaNode);
    } else {
      nodes.push(createTextParagraph(formatWikilink(parsed)));
    }

    lastIndex = end;
  }

  if (!changed) {
    return undefined;
  }

  const after = fullText.slice(lastIndex).trim();
  if (after.length > 0) {
    nodes.push(createTextParagraph(after));
  }

  return nodes;
}

function createMediaNodeFromParsed(
  parsed: ParsedLinktext,
  context: MediaResolveContext,
): Content | undefined {
  const mediaKind = getMediaKind(parsed.path);
  if (!mediaKind) {
    return undefined;
  }

  const resolved = resolveVaultPath(parsed.path, context);

  if (!resolved) {
    return undefined;
  }

  const fileName = ankiFileNameForVaultPath(resolved, context);
  return createResolvedMediaNode(mediaKind, fileName, parsed.displayText);
}

function createTextParagraph(text: string): Paragraph {
  return {
    type: "paragraph",
    children: [{ type: "text", value: text }],
  };
}

function addPathPlan(
  plans: MediaUploadPlan[],
  seenPaths: Set<string>,
  fileName: string,
  absolutePath: string,
  vaultRelativePath: string,
  dryRun: boolean,
  forceBase64Media?: boolean,
): void {
  if (seenPaths.has(absolutePath)) {
    return;
  }

  seenPaths.add(absolutePath);
  const plan: MediaUploadPlan = {
    fileName,
    transport: forceBase64Media ? "base64" : "path",
    absolutePath,
    vaultRelativePath,
  };
  plans.push(plan);

  if (dryRun) {
    enqueueMediaDryRun(plan);
  }
}

function addUrlPlan(
  plans: MediaUploadPlan[],
  fileName: string,
  sourceUrl: string,
  dryRun: boolean,
): void {
  if (plans.some((plan) => plan.sourceUrl === sourceUrl)) {
    return;
  }

  const plan: MediaUploadPlan = {
    fileName,
    transport: "url",
    sourceUrl,
  };
  plans.push(plan);

  if (dryRun) {
    enqueueMediaDryRun(plan);
  }
}

export function collectMediaNodes(ast: Root) {
  const nodes: Array<{ kind: "wikiEmbed" | "image"; fileName: string }> = [];

  const walk = (items: Content[]) => {
    for (const node of items) {
      if (node.type === "image") {
        nodes.push({ kind: "image", fileName: node.url });
        continue;
      }

      if (isObsidianEmbed(node) && isMediaPath(node.data.path)) {
        nodes.push({ kind: "wikiEmbed", fileName: node.data.path });
        continue;
      }

      if ("children" in node && Array.isArray(node.children)) {
        walk(node.children as Content[]);
      }
    }
  };

  walk(ast.children);
  return nodes;
}

export function resolveMediaPaths(
  mediaNodes: Array<{ kind: "wikiEmbed" | "image"; fileName: string }>,
  vaultPath: string,
) {
  return mediaNodes.map((node) => ({
    fileName: node.fileName.split("/").pop() ?? node.fileName,
    absolutePath: resolvePath(vaultPath, node.fileName),
  }));
}
