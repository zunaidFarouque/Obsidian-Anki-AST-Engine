import { describe, expect, test } from "bun:test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Content } from "mdast";
import { parseMarkdown } from "../../src/ast/processor";
import { stripFrontmatter } from "../../src/io/frontmatterFilter";
import {
  collectMediaNodes,
  resolveMedia,
  resolveMediaPaths,
} from "../../src/ast/mediaResolver";
import { graftTransclusions } from "../../src/ast/transclusionGraft";
import { buildVaultFileIndex } from "../../src/obsidian/vaultIndex";
import { assertFixtureMediaReady } from "../helpers/fixtureMedia";

function collectImageUrls(ast: { children: Content[] }): string[] {
  const urls: string[] = [];
  const walk = (nodes: Content[]) => {
    for (const node of nodes) {
      if (node.type === "image") {
        urls.push(node.url);
      }
      if ("children" in node && Array.isArray(node.children)) {
        walk(node.children as Content[]);
      }
    }
  };
  walk(ast.children);
  return urls;
}

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
    expect(resolved.some((entry) => entry.fileName.includes("toppng"))).toBe(
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
    await assertFixtureMediaReady(vaultPath);

    const vaultIndex = await buildVaultFileIndex(vaultPath);
    const ast = parseMarkdown(stripFrontmatter(rawText), vaultPath);
    await graftTransclusions(ast, {
      vaultPath,
      sourcePath: "complex-media-paths.md",
      vaultIndex,
    });

    const result = await resolveMedia(ast, {
      vaultPath,
      sourcePath: "complex-media-paths.md",
      vaultIndex,
      dryRun: true,
    });

    expect(result.plans.length).toBeGreaterThanOrEqual(4);

    const imageUrls = collectImageUrls(ast);
    expect(imageUrls).toContain("toppng.com-cartoon-1254x1254.png");
    expect(imageUrls).toContain("path.png");
    expect(imageUrls).toContain("jpeg-home.jpg");
    expect(imageUrls).toContain("koala.webp");

    const planNames = result.plans.map((plan) => plan.fileName);
    expect(planNames).toContain("jpeg-home.jpg");
    expect(planNames).toContain("koala.webp");
  });
});
