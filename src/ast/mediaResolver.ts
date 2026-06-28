import { resolve as resolvePath } from "node:path";
import type { Content, Image, Paragraph, Root } from "mdast";
import { isObsidianEmbed } from "./obsidianLinks";
import { formatWikilink, parseLinktext, type ParsedLinktext } from "../obsidian/linkResolver";
import {
  isImageMediaPath,
  isMediaPath,
  resolveAttachmentPath,
  type VaultFileIndex,
} from "../obsidian/vaultIndex";
import { enqueueMediaDryRun } from "../anki/mediaQueue";
import { toAnkiMediaFileName } from "../anki/mediaFileName";

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

const WIKI_EMBED_IN_TEXT = /!\[\[([^\]]+)\]\]/g;

export async function resolveMedia(
  ast: Root,
  context: MediaResolveContext,
): Promise<MediaResolveResult> {
  rewriteRemainingMediaEmbeds(ast.children, context);

  const plans: MediaUploadPlan[] = [];
  const seen = new Set<string>();

  visitImages(ast, (node) => {
    const resolved = resolveAttachmentPath(
      node.url,
      context.sourcePath,
      context.vaultIndex,
      context.attachmentFolder,
    );

    if (!resolved) {
      return;
    }

    const absolutePath = resolvePath(context.vaultIndex.vaultPath, resolved);
    const vaultBaseName = resolved.split("/").pop() ?? resolved;
    const fileName = toAnkiMediaFileName(vaultBaseName);
    node.url = fileName;
    addPlan(plans, seen, fileName, absolutePath, resolved, context.dryRun);
  });

  return { plans };
}

function visitImages(ast: Root, onImage: (node: Image) => void): void {
  const walk = (nodes: Content[]) => {
    for (const node of nodes) {
      if (node.type === "image") {
        onImage(node);
      }

      if ("children" in node && Array.isArray(node.children)) {
        walk(node.children as Content[]);
      }
    }
  };

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

    if (isObsidianEmbed(child) && isImageMediaPath(child.data.path) && !child.data.subpath) {
      const image = createImageNodeFromParsed(child.data, context);
      if (image) {
        children[index] = image;
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

    if (!isImageMediaPath(parsed.path) || parsed.subpath) {
      continue;
    }

    changed = true;
    const before = fullText.slice(lastIndex, start).trim();
    if (before.length > 0) {
      nodes.push(createTextParagraph(before));
    }

    const image = createImageNodeFromParsed(parsed, context);
    if (image) {
      nodes.push(image);
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

function createImageNodeFromParsed(
  parsed: ParsedLinktext,
  context: MediaResolveContext,
): Image | undefined {
  const resolved = resolveAttachmentPath(
    parsed.path,
    context.sourcePath,
    context.vaultIndex,
    context.attachmentFolder,
  );

  if (!resolved) {
    return undefined;
  }

  const fileName = toAnkiMediaFileName(
    resolved.split("/").pop() ?? resolved,
  );
  return {
    type: "image",
    url: fileName,
    alt: parsed.displayText ?? "",
  };
}

function createTextParagraph(text: string): Paragraph {
  return {
    type: "paragraph",
    children: [{ type: "text", value: text }],
  };
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
