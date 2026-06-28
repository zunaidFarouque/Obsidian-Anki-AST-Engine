import { describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  MEDIA_HASH_SEPARATOR,
  buildAnkiMediaNameMap,
  hashFileContent,
  insertHashBeforeExtension,
} from "../../src/anki/mediaNaming";

describe("mediaNaming", () => {
  test("insertHashBeforeExtension inserts _=_ hash before extension", () => {
    expect(insertHashBeforeExtension("koala.webp", "a3f9b2c1")).toBe(
      `koala${MEDIA_HASH_SEPARATOR}a3f9b2c1.webp`,
    );
    expect(insertHashBeforeExtension("my.photo.webp", "7e2d1044")).toBe(
      `my.photo${MEDIA_HASH_SEPARATOR}7e2d1044.webp`,
    );
  });

  test("hashFileContent returns first 8 hex chars of sha256", () => {
    const hash = hashFileContent(Buffer.from("hello"));
    expect(hash).toHaveLength(8);
    expect(hash).toBe(hashFileContent(Buffer.from("hello")));
    expect(hash).not.toBe(hashFileContent(Buffer.from("world")));
  });

  test("buildAnkiMediaNameMap keeps plain basename when unique", async () => {
    const root = await mkdtemp(join(tmpdir(), "media-naming-"));
    await mkdir(join(root, "assets"), { recursive: true });
    await writeFile(join(root, "assets", "unique.png"), "unique-bytes");

    const result = await buildAnkiMediaNameMap([
      {
        vaultRelativePath: "assets/unique.png",
        absolutePath: join(root, "assets", "unique.png"),
      },
    ]);

    expect(result.nameByVaultPath.get("assets/unique.png")).toBe("unique.png");
    expect(result.warnings).toHaveLength(0);
    await rm(root, { recursive: true, force: true });
  });

  test("buildAnkiMediaNameMap disambiguates colliding basenames with different content", async () => {
    const root = await mkdtemp(join(tmpdir(), "media-naming-"));
    await mkdir(join(root, "a"), { recursive: true });
    await mkdir(join(root, "b"), { recursive: true });
    await writeFile(join(root, "a", "koala.webp"), "bytes-a");
    await writeFile(join(root, "b", "koala.webp"), "bytes-b");

    const result = await buildAnkiMediaNameMap([
      {
        vaultRelativePath: "a/koala.webp",
        absolutePath: join(root, "a", "koala.webp"),
      },
      {
        vaultRelativePath: "b/koala.webp",
        absolutePath: join(root, "b", "koala.webp"),
      },
    ]);

    const nameA = result.nameByVaultPath.get("a/koala.webp");
    const nameB = result.nameByVaultPath.get("b/koala.webp");
    expect(nameA).toContain(MEDIA_HASH_SEPARATOR);
    expect(nameB).toContain(MEDIA_HASH_SEPARATOR);
    expect(nameA).not.toBe(nameB);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.kind).toBe("media_basename_disambiguated");
    await rm(root, { recursive: true, force: true });
  });

  test("buildAnkiMediaNameMap collapses identical content to one anki filename", async () => {
    const root = await mkdtemp(join(tmpdir(), "media-naming-"));
    const fixture = join(import.meta.dir, "../fixtures/assets/media/koala.webp");
    await mkdir(join(root, "a"), { recursive: true });
    await mkdir(join(root, "b"), { recursive: true });
    await copyFile(fixture, join(root, "a", "koala.webp"));
    await copyFile(fixture, join(root, "b", "koala.webp"));

    const result = await buildAnkiMediaNameMap([
      {
        vaultRelativePath: "a/koala.webp",
        absolutePath: join(root, "a", "koala.webp"),
      },
      {
        vaultRelativePath: "b/koala.webp",
        absolutePath: join(root, "b", "koala.webp"),
      },
    ]);

    const nameA = result.nameByVaultPath.get("a/koala.webp");
    const nameB = result.nameByVaultPath.get("b/koala.webp");
    expect(nameA).toBe(nameB);
    expect(nameA).toContain(MEDIA_HASH_SEPARATOR);
    await rm(root, { recursive: true, force: true });
  });
});
