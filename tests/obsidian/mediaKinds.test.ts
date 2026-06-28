import { describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildVaultFileIndex,
  getMediaKind,
  isAttachableMediaPath,
  resolveAttachmentPath,
} from "../../src/obsidian/vaultIndex";

describe("getMediaKind", () => {
  test("classifies raster images, svg, audio, video, and pdf", () => {
    expect(getMediaKind("photo.png")).toBe("rasterImage");
    expect(getMediaKind("photo.JPG")).toBe("rasterImage");
    expect(getMediaKind("icon.svg")).toBe("svg");
    expect(getMediaKind("lecture.mp3")).toBe("audio");
    expect(getMediaKind("clip.mp4")).toBe("video");
    expect(getMediaKind("slides.pdf")).toBe("pdf");
    expect(getMediaKind("note.md")).toBeNull();
  });
});

describe("isAttachableMediaPath", () => {
  test("returns true for known media extensions", () => {
    expect(isAttachableMediaPath("lecture.mp3")).toBe(true);
    expect(isAttachableMediaPath("slides.pdf")).toBe(true);
    expect(isAttachableMediaPath("note.md")).toBe(false);
  });
});

describe("resolveAttachmentPath for non-image media", () => {
  test("resolves basename-only mp3 embed", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-media-kind-"));
    await mkdir(join(root, "assets", "media"), { recursive: true });
    await copyFile(
      join(import.meta.dir, "../fixtures/assets/media/sample.mp3"),
      join(root, "assets", "media", "sample.mp3"),
    );

    const index = await buildVaultFileIndex(root);
    const resolved = resolveAttachmentPath(
      "sample.mp3",
      "complex-media-non-image.md",
      index,
    );

    expect(resolved).toBe("assets/media/sample.mp3");
    await rm(root, { recursive: true, force: true });
  });

  test("resolves basename-only pdf embed", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-media-kind-"));
    await mkdir(join(root, "assets", "media"), { recursive: true });
    await copyFile(
      join(import.meta.dir, "../fixtures/assets/media/sample.pdf"),
      join(root, "assets", "media", "sample.pdf"),
    );

    const index = await buildVaultFileIndex(root);
    const resolved = resolveAttachmentPath(
      "sample.pdf",
      "complex-media-non-image.md",
      index,
    );

    expect(resolved).toBe("assets/media/sample.pdf");
    await rm(root, { recursive: true, force: true });
  });
});
