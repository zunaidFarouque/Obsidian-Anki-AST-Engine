import type { Content, Image, Link, Paragraph } from "mdast";
import type { MediaKind } from "../obsidian/vaultIndex";

export function createResolvedMediaNode(
  kind: MediaKind,
  ankiFileName: string,
  displayText?: string,
): Content {
  if (kind === "rasterImage" || kind === "svg") {
    const image: Image = {
      type: "image",
      url: ankiFileName,
      alt: displayText ?? "",
    };
    return image;
  }

  if (kind === "audio" || kind === "video") {
    const paragraph: Paragraph = {
      type: "paragraph",
      children: [{ type: "text", value: `[sound:${ankiFileName}]` }],
    };
    return paragraph;
  }

  const link: Link = {
    type: "link",
    url: ankiFileName,
    children: [{ type: "text", value: displayText ?? ankiFileName }],
  };

  const paragraph: Paragraph = {
    type: "paragraph",
    children: [link],
  };
  return paragraph;
}

export const SOUND_TAG_PATTERN = /^\[sound:([^\]]+)\]$/;

export function isSoundMediaParagraph(node: Content): boolean {
  if (node.type !== "paragraph" || node.children.length !== 1) {
    return false;
  }

  const child = node.children[0];
  return child?.type === "text" && SOUND_TAG_PATTERN.test(child.value);
}

export function soundFileNameFromParagraph(node: Paragraph): string | null {
  const child = node.children[0];
  if (child?.type !== "text") {
    return null;
  }

  const match = child.value.match(SOUND_TAG_PATTERN);
  return match?.[1] ?? null;
}

export function isPdfLinkParagraph(node: Content): boolean {
  if (node.type !== "paragraph" || node.children.length !== 1) {
    return false;
  }

  const child = node.children[0];
  return child?.type === "link" && child.url.toLowerCase().endsWith(".pdf");
}
