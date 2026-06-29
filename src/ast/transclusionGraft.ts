import type { Content, Root } from "mdast";
import type { Parent } from "unist";
import { visit } from "unist-util-visit";
import { parseMarkdown } from "./processor";
import { isObsidianEmbed, type ObsidianEmbed } from "./obsidianLinks";
import {
  formatWikilink,
  getFirstLinkpathDest,
  parseLinktext,
  resolveSubpath,
} from "../obsidian/linkResolver";
import type { VaultFileIndex } from "../obsidian/vaultIndex";
import {
  getMediaKind,
  resolveAttachmentPath,
} from "../obsidian/vaultIndex";
import { createResolvedMediaNode } from "./vaultMediaNodes";
import { stripFrontmatter } from "../io/frontmatterFilter";
import type { VaultAdapter } from "../io/vaultAdapter";
import { readFile } from "node:fs/promises";
import { resolve as nodeResolve } from "node:path";

export type GraftContext = {
  vaultPath: string;
  sourcePath: string;
  vaultIndex: VaultFileIndex;
  vault?: VaultAdapter;
  attachmentFolder?: string;
  linkFormat?: "shortest" | "relative" | "absolute";
  visiting?: Set<string>;
  unresolvedEmbeds?: string[];
};

export type GraftOptions = GraftContext;

export async function graftTransclusions(
  ast: Root,
  context: GraftContext,
): Promise<Root> {
  const visiting = context.visiting ?? new Set<string>();
  const unresolvedEmbeds = context.unresolvedEmbeds ?? [];
  await resolveEmbedsInChildren(ast, { ...context, visiting, unresolvedEmbeds });
  return ast;
}

async function resolveEmbedsInChildren(
  parent: Parent,
  context: Required<
    Pick<GraftContext, "vaultPath" | "sourcePath" | "vaultIndex">
  > & {
    vault?: VaultAdapter;
    attachmentFolder?: string;
    linkFormat?: "shortest" | "relative" | "absolute";
    visiting: Set<string>;
    unresolvedEmbeds: string[];
  },
): Promise<void> {
  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index];
    if (!child) {
      continue;
    }

    if (child.type === "root") {
      await resolveEmbedsInChildren(child as Root, context);
      continue;
    }

    if ("children" in child && Array.isArray(child.children)) {
      await resolveEmbedsInChildren(child as Parent, context);
    }

    if (isObsidianEmbed(child)) {
      const replacement = await resolveObsidianEmbed(
        child,
        context.sourcePath,
        context,
      );
      parent.children.splice(index, 1, ...replacement);
      index += replacement.length - 1;
      continue;
    }

    if (child.type !== "paragraph") {
      continue;
    }

    const paragraph = child as Content & Parent;
    const legacyEmbed = findLegacyEmbedInParagraph(paragraph);
    if (!legacyEmbed) {
      continue;
    }

    const parsed = parseLinktext(legacyEmbed.linktext, true);
    const replacement = await resolveParsedEmbed(
      parsed,
      legacyEmbed.before,
      legacyEmbed.after,
      context.sourcePath,
      context,
    );

    parent.children.splice(index, 1, ...replacement);
    index += replacement.length - 1;
  }
}

async function resolveObsidianEmbed(
  embed: ObsidianEmbed,
  sourcePath: string,
  context: {
    vaultPath: string;
    sourcePath: string;
    vaultIndex: VaultFileIndex;
    attachmentFolder?: string;
    visiting: Set<string>;
    unresolvedEmbeds: string[];
  },
): Promise<Content[]> {
  return resolveParsedEmbed(
    embed.data,
    "",
    "",
    sourcePath,
    context,
  );
}

type LegacyEmbedInfo = {
  linktext: string;
  before: string;
  after: string;
};

function findLegacyEmbedInParagraph(
  paragraph: Content & Parent,
): LegacyEmbedInfo | null {
  const fullText = paragraph.children
    .map((child) => ("value" in child ? String(child.value) : ""))
    .join("");

  const match = fullText.match(/!\[\[([^\]]+)\]\]/);
  if (!match) {
    return null;
  }

  const embedStart = match.index ?? 0;
  const embedEnd = embedStart + match[0].length;

  return {
    linktext: match[1]!.trim(),
    before: fullText.slice(0, embedStart),
    after: fullText.slice(embedEnd),
  };
}

async function resolveParsedEmbed(
  parsed: ReturnType<typeof parseLinktext>,
  before: string,
  after: string,
  sourcePath: string,
  context: {
    vaultPath: string;
    vaultIndex: VaultFileIndex;
    attachmentFolder?: string;
    linkFormat?: "shortest" | "relative" | "absolute";
    visiting: Set<string>;
    unresolvedEmbeds: string[];
  },
): Promise<Content[]> {
  const mediaKind = getMediaKind(parsed.path);
  if (mediaKind && !parsed.subpath) {
    return resolveVaultMediaEmbed(parsed, before, after, sourcePath, context);
  }

  const destPath = getFirstLinkpathDest(
    parsed.path,
    sourcePath,
    context.vaultIndex,
  );

  if (!destPath) {
    const marker = formatWikilink(parsed);
    context.unresolvedEmbeds.push(marker);
    return buildReplacementNodes(before, [createTextParagraph(marker)], after);
  }

  const visitKey = parsed.subpath
    ? `${destPath}${parsed.subpath}`
    : destPath;

  if (context.visiting.has(visitKey)) {
    return buildReplacementNodes(before, [], after);
  }

  context.visiting.add(visitKey);

  let grafted: Content[];
  if (parsed.subpath) {
    const cache = context.vaultIndex.fileCaches.get(destPath);
    grafted = cache ? resolveSubpath(cache, parsed.subpath) ?? [] : [];
  } else {
    grafted = await loadFileNodes(destPath, context);
  }

  if (grafted.length === 0 && parsed.subpath) {
    const marker = formatWikilink(parsed);
    context.unresolvedEmbeds.push(marker);
    context.visiting.delete(visitKey);
    return buildReplacementNodes(before, [createTextParagraph(marker)], after);
  }

  const wrapper: Root = { type: "root", children: structuredClone(grafted) };
  await resolveEmbedsInChildren(wrapper, {
    ...context,
    sourcePath: destPath,
  });

  context.visiting.delete(visitKey);
  return buildReplacementNodes(before, wrapper.children, after);
}

function resolveVaultMediaEmbed(
  parsed: ReturnType<typeof parseLinktext>,
  before: string,
  after: string,
  sourcePath: string,
  context: {
    vaultIndex: VaultFileIndex;
    attachmentFolder?: string;
    linkFormat?: "shortest" | "relative" | "absolute";
    unresolvedEmbeds: string[];
  },
): Content[] {
  const mediaKind = getMediaKind(parsed.path);
  if (!mediaKind) {
    const marker = formatWikilink(parsed);
    context.unresolvedEmbeds.push(marker);
    return buildReplacementNodes(before, [createTextParagraph(marker)], after);
  }

  const resolved = resolveAttachmentPath(
    parsed.path,
    sourcePath,
    context.vaultIndex,
    {
      attachmentFolder: context.attachmentFolder,
      linkFormat: context.linkFormat,
    },
  );

  if (!resolved) {
    const marker = formatWikilink(parsed);
    context.unresolvedEmbeds.push(marker);
    return buildReplacementNodes(before, [createTextParagraph(marker)], after);
  }

  const fileName = resolved.split("/").pop() ?? resolved;
  const mediaNode = createResolvedMediaNode(
    mediaKind,
    fileName,
    parsed.displayText,
  );

  return buildReplacementNodes(before, [mediaNode], after);
}

async function loadFileNodes(
  destPath: string,
  context: { vaultPath: string; vaultIndex: VaultFileIndex; vault?: VaultAdapter },
): Promise<Content[]> {
  const cache = context.vaultIndex.fileCaches.get(destPath);
  if (cache) {
    return structuredClone(cache.ast.children) as Content[];
  }

  try {
    const rawText = context.vault
      ? await context.vault.readText(destPath)
      : await readFile(nodeResolve(context.vaultPath, destPath), "utf8");
    const ast = parseMarkdown(stripFrontmatter(rawText), context.vaultPath);
    return [...ast.children];
  } catch {
    return [];
  }
}

function buildReplacementNodes(
  before: string,
  grafted: Content[],
  after: string,
): Content[] {
  const nodes: Content[] = [];

  if (before.trim().length > 0) {
    nodes.push(createTextParagraph(before.trim()));
  }

  nodes.push(...grafted);

  if (after.trim().length > 0) {
    nodes.push(createTextParagraph(after.trim()));
  }

  if (nodes.length === 0) {
    return grafted;
  }

  return nodes;
}

function createTextParagraph(text: string): Content {
  return {
    type: "paragraph",
    children: [{ type: "text", value: text }],
  };
}

export function collectTextFromAst(ast: Root): string {
  const parts: string[] = [];
  visit(ast, (visited) => {
    if (
      (visited.type === "text" ||
        visited.type === "math" ||
        visited.type === "inlineMath") &&
      "value" in visited
    ) {
      parts.push(String(visited.value));
    }
  });
  return parts.join("");
}
