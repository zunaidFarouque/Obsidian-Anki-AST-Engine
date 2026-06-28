import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMarkdown } from "../../src/ast/processor";
import { stripFrontmatter } from "../../src/io/frontmatterFilter";
import {
  collectTextFromAst,
  graftTransclusions,
} from "../../src/ast/transclusionGraft";
import { findBlockById } from "../../src/ast/blockIdTagging";
import { buildVaultFileIndex } from "../../src/obsidian/vaultIndex";
import { isObsidianEmbed } from "../../src/ast/obsidianLinks";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");
const VAULT_DIR = join(FIXTURES_DIR, "vault");

async function buildContext(sourceFile: string) {
  const vaultIndex = await buildVaultFileIndex(VAULT_DIR);
  return {
    vaultPath: VAULT_DIR,
    sourcePath: sourceFile,
    vaultIndex,
    unresolvedEmbeds: [] as string[],
  };
}

async function loadAndGraft(name: string) {
  const rawText = await readFile(join(FIXTURES_DIR, `${name}.md`), "utf8");
  const ast = parseMarkdown(stripFrontmatter(rawText), VAULT_DIR);
  const context = await buildContext(`${name}.md`);
  await graftTransclusions(ast, context);
  return { ast, context };
}

describe("blockIdTagging", () => {
  test("finds block by caret id suffix in vault file", async () => {
    const rawText = await readFile(join(VAULT_DIR, "Design.md"), "utf8");
    const ast = parseMarkdown(rawText, VAULT_DIR);
    const block = findBlockById(ast, "singleton");

    expect(block).not.toBeNull();
    expect(collectTextFromAst({ type: "root", children: block ?? [] })).toContain(
      "singleton pattern",
    );
    expect(collectTextFromAst({ type: "root", children: block ?? [] })).not.toContain(
      "^singleton",
    );
  });

  test("finds list block id on separate line", async () => {
    const rawText = await readFile(
      join(import.meta.dir, "../fixtures/obsidian-parity/block-id-list.md"),
      "utf8",
    );
    const ast = parseMarkdown(stripFrontmatter(rawText), VAULT_DIR);
    const block = findBlockById(ast, "list-block");
    const text = collectTextFromAst({ type: "root", children: block ?? [] });
    expect(text).toContain("Item one");
    expect(text).toContain("Item two");
  });
});

describe("obsidianLinks", () => {
  test("creates obsidianEmbed nodes from wiki embed syntax", () => {
    const ast = parseMarkdown("![[Design#^singleton]]", VAULT_DIR);
    const embed = ast.children.find((child) => isObsidianEmbed(child));
    expect(embed).toBeDefined();
    expect(embed?.data.path).toBe("Design");
    expect(embed?.data.subpath).toBe("#^singleton");
  });
});

describe("transclusionGraft", () => {
  test("grafts Design block for deep-nested-transclusions fixture", async () => {
    const { ast } = await loadAndGraft("deep-nested-transclusions");
    const text = collectTextFromAst(ast);

    expect(text).toContain("singleton pattern");
    expect(text).not.toMatch(/!\[\[Design#\^singleton\]\]/);
    expect(text).toContain("Restricts instantiation");
  });

  test("grafts nested embed chain for deep-transclusion-resolution fixture", async () => {
    const { ast } = await loadAndGraft("deep-transclusion-resolution");
    const text = collectTextFromAst(ast);

    expect(text).toContain("E=mc^2");
    expect(text).not.toMatch(/!\[\[ChildNote#\^section-id\]\]/);
    expect(text).not.toMatch(/!\[\[InnerEmbedTarget#\^formula-block\]\]/);
  });

  test("does not loop on cyclical transclusion references", async () => {
    const visiting = new Set<string>();
    const vaultIndex = await buildVaultFileIndex(VAULT_DIR);
    const ast = parseMarkdown("![[Design#^singleton]]", VAULT_DIR);
    visiting.add(`Design.md#^singleton`);

    await graftTransclusions(ast, {
      vaultPath: VAULT_DIR,
      sourcePath: "test.md",
      vaultIndex,
      visiting,
    });
    expect(collectTextFromAst(ast)).not.toContain("![[");
  });

  test("preserves unresolved embed marker", async () => {
    const rawText = await readFile(
      join(import.meta.dir, "../fixtures/obsidian-parity/unresolved-embed.md"),
      "utf8",
    );
    const ast = parseMarkdown(stripFrontmatter(rawText), VAULT_DIR);
    const context = await buildContext("unresolved-embed.md");
    await graftTransclusions(ast, context);

    expect(context.unresolvedEmbeds.length).toBeGreaterThan(0);
    expect(collectTextFromAst(ast)).toContain("![[Does Not Exist#^missing]]");
  });
});
