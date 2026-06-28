import { describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildVaultFileIndex,
  resolveAttachmentPath,
} from "../../src/obsidian/vaultIndex";

describe("resolveAttachmentPath", () => {
  test("resolves basename-only embed when file is unique in vault", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-media-"));
    await mkdir(join(root, "assets", "media"), { recursive: true });
    await copyFile(
      join(import.meta.dir, "../fixtures/assets/media/koala.webp"),
      join(root, "assets", "media", "koala.webp"),
    );

    const index = await buildVaultFileIndex(root);
    const resolved = resolveAttachmentPath(
      "koala.webp",
      "complex-media-paths.md",
      index,
    );

    expect(resolved).toBe("assets/media/koala.webp");
    await rm(root, { recursive: true, force: true });
  });

  test("resolves basename-only embed scoped under source note directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-media-"));
    const noteDir = join(root, "z_Plugins Tester");
    await mkdir(join(noteDir, "attachments"), { recursive: true });
    await copyFile(
      join(import.meta.dir, "../fixtures/assets/media/koala.webp"),
      join(noteDir, "attachments", "koala.webp"),
    );
    await mkdir(join(root, "assets", "media"), { recursive: true });
    await copyFile(
      join(import.meta.dir, "../fixtures/assets/media/jpeg-home.jpg"),
      join(root, "assets", "media", "koala.webp"),
    );

    const index = await buildVaultFileIndex(root);
    const resolved = resolveAttachmentPath(
      "koala.webp",
      "z_Plugins Tester/New plugin testing.md",
      index,
      { attachmentFolder: "attachments" },
    );

    expect(resolved).toBe("z_Plugins Tester/attachments/koala.webp");
    await rm(root, { recursive: true, force: true });
  });

  test("prefers shortest path when basename is ambiguous vault-wide", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-media-"));
    await mkdir(join(root, "assets", "nested"), { recursive: true });
    await mkdir(join(root, "deep", "nested"), { recursive: true });
    await copyFile(
      join(import.meta.dir, "../fixtures/assets/nested/path.png"),
      join(root, "path.png"),
    );
    await copyFile(
      join(import.meta.dir, "../fixtures/assets/nested/path.png"),
      join(root, "assets", "nested", "path.png"),
    );

    const index = await buildVaultFileIndex(root);
    const resolved = resolveAttachmentPath(
      "path.png",
      "complex-media-paths.md",
      index,
      { linkFormat: "shortest" },
    );

    expect(resolved).toBe("path.png");
    await rm(root, { recursive: true, force: true });
  });

  test("still resolves explicit relative paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-media-"));
    await mkdir(join(root, "assets", "nested"), { recursive: true });
    await copyFile(
      join(import.meta.dir, "../fixtures/assets/nested/path.png"),
      join(root, "assets", "nested", "path.png"),
    );

    const index = await buildVaultFileIndex(root);
    const resolved = resolveAttachmentPath(
      "assets/nested/path.png",
      "complex-media-paths.md",
      index,
    );

    expect(resolved).toBe("assets/nested/path.png");
    await rm(root, { recursive: true, force: true });
  });

  test("returns null when basename matches are equally ambiguous", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-media-"));
    await mkdir(join(root, "a"), { recursive: true });
    await mkdir(join(root, "b"), { recursive: true });
    await copyFile(
      join(import.meta.dir, "../fixtures/assets/media/koala.webp"),
      join(root, "a", "koala.webp"),
    );
    await copyFile(
      join(import.meta.dir, "../fixtures/assets/media/koala.webp"),
      join(root, "b", "koala.webp"),
    );

    const index = await buildVaultFileIndex(root);
    const resolved = resolveAttachmentPath(
      "koala.webp",
      "notes/card.md",
      index,
    );

    expect(resolved).toBeNull();
    await rm(root, { recursive: true, force: true });
  });
});
