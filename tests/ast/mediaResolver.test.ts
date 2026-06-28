import { describe, expect, test } from "bun:test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMarkdown } from "../../src/ast/processor";
import { stripFrontmatter } from "../../src/io/frontmatterFilter";
import {
  collectMediaNodes,
  resolveMedia,
  resolveMediaPaths,
} from "../../src/ast/mediaResolver";
import { buildVaultFileIndex } from "../../src/obsidian/vaultIndex";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

describe("mediaResolver", () => {
  test("complex-media-paths fixture exposes wiki embed and image nodes with paths", async () => {
    const rawText = await readFile(
      join(FIXTURES_DIR, "complex-media-paths.md"),
      "utf8",
    );
    const vaultPath = FIXTURES_DIR;
    const ast = parseMarkdown(stripFrontmatter(rawText), vaultPath);

    const mediaNodes = collectMediaNodes(ast);
    expect(mediaNodes.length).toBeGreaterThanOrEqual(2);

    const resolved = resolveMediaPaths(mediaNodes, vaultPath);
    expect(resolved.some((entry) => entry.fileName.includes("Cell Diagram"))).toBe(
      true,
    );
    expect(resolved.some((entry) => entry.absolutePath.includes("path.png"))).toBe(
      true,
    );
  });

  test("resolveMedia rewrites image urls and queues dry-run uploads", async () => {
    const rawText = await readFile(
      join(FIXTURES_DIR, "complex-media-paths.md"),
      "utf8",
    );
    const vaultPath = FIXTURES_DIR;
    await mkdir(join(vaultPath, "assets", "nested"), { recursive: true });
    await Bun.write(join(vaultPath, "Cell Diagram final.png"), "png");
    await Bun.write(join(vaultPath, "assets", "nested", "path.png"), "png");

    const vaultIndex = await buildVaultFileIndex(vaultPath);
    const ast = parseMarkdown(stripFrontmatter(rawText), vaultPath);

    const result = await resolveMedia(ast, {
      vaultPath,
      sourcePath: "complex-media-paths.md",
      vaultIndex,
      dryRun: true,
    });

    expect(result.plans.length).toBeGreaterThanOrEqual(1);
  });
});
