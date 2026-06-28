import { resolve as resolvePath } from "node:path";
import type { Root, Paragraph } from "mdast";
import type { Node } from "unist";
import { visit } from "unist-util-visit";
import { isObsidianEmbed } from "./obsidianLinks";
import { parseLinktext } from "../obsidian/linkResolver";
import {
  isMediaPath,
  resolveAttachmentPath,
  type VaultFileIndex,
} from "../obsidian/vaultIndex";
import { enqueueMediaDryRun } from "../anki/mediaQueue";

export type MediaUploadPlan = {
  fileName: string;
  absolutePath: string;
  vaultRelativePath: string;
};

export type MediaResolveResult = {
  plans: MediaUploadPlan[];
};

export type MediaResolveContext = {
  vaultPath: string;
  sourcePath: string;
  vaultIndex: VaultFileIndex;
  attachmentFolder?: string;
  dryRun: boolean;
};

const WIKI_EMBED_IN_TEXT = /!\[\[([^\]]+)\]\]/;

export async function resolveMedia(
  ast: Root,
  context: MediaResolveContext,
): Promise<MediaResolveResult> {
  const plans: MediaUploadPlan[] = [];
  const seen = new Set<string>();

  visit(ast, (node: Node) => {
    if (node.type === "image" && "url" in node && typeof node.url === "string") {
      const resolved = resolveAttachmentPath(
        node.url,
        context.sourcePath,
        context.vaultIndex,
        context.attachmentFolder,
      );

      if (!resolved) {
        return;
      }

      const absolutePath = resolvePath(context.vaultPath, resolved);
      const fileName = resolved.split("/").pop() ?? resolved;
      node.url = fileName;
      addPlan(plans, seen, fileName, absolutePath, resolved, context.dryRun);
      return;
    }

    if (isObsidianEmbed(node)) {
      const embed = node;
      const parsed = embed.data;
      if (!isMediaPath(parsed.path)) {
        return;
      }

      const resolved = resolveAttachmentPath(
        parsed.path,
        context.sourcePath,
        context.vaultIndex,
        context.attachmentFolder,
      );

      if (!resolved) {
        return;
      }

      const absolutePath = resolvePath(context.vaultPath, resolved);
      const fileName = resolved.split("/").pop() ?? resolved;
      addPlan(plans, seen, fileName, absolutePath, resolved, context.dryRun);
      return;
    }

    if (node.type !== "paragraph") {
      return;
    }

    const paragraph = node as Paragraph;
    const text = paragraph.children
      .map((child) => ("value" in child ? String(child.value) : ""))
      .join("");

    const match = text.match(WIKI_EMBED_IN_TEXT);
    if (!match?.[1]) {
      return;
    }

    const parsed = parseLinktext(match[1], true);
    if (!isMediaPath(parsed.path)) {
      return;
    }

    const resolved = resolveAttachmentPath(
      parsed.path,
      context.sourcePath,
      context.vaultIndex,
      context.attachmentFolder,
    );

    if (!resolved) {
      return;
    }

    const absolutePath = resolvePath(context.vaultPath, resolved);
    const fileName = resolved.split("/").pop() ?? resolved;
    addPlan(plans, seen, fileName, absolutePath, resolved, context.dryRun);
  });

  return { plans };
}

function addPlan(
  plans: MediaUploadPlan[],
  seen: Set<string>,
  fileName: string,
  absolutePath: string,
  vaultRelativePath: string,
  dryRun: boolean,
): void {
  if (seen.has(absolutePath)) {
    return;
  }

  seen.add(absolutePath);
  const plan = { fileName, absolutePath, vaultRelativePath };
  plans.push(plan);

  if (dryRun) {
    enqueueMediaDryRun(plan);
  }
}

export function collectMediaNodes(ast: Root) {
  const nodes: Array<{ kind: "wikiEmbed" | "image"; fileName: string }> = [];

  visit(ast, (node: Node) => {
    if (node.type === "image" && "url" in node && typeof node.url === "string") {
      nodes.push({ kind: "image", fileName: node.url });
      return;
    }

    if (isObsidianEmbed(node)) {
      const embed = node;
      if (isMediaPath(embed.data.path)) {
        nodes.push({ kind: "wikiEmbed", fileName: embed.data.path });
      }
    }
  });

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
