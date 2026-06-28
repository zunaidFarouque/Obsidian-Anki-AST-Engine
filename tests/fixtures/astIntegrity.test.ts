import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMarkdown } from "../../src/ast/processor";
import {
  getBodyStartOffset,
  getCardDeclarationHeadingLevel,
  getDelimiter,
} from "../../src/io/frontmatterFilter";
import {
  buildInjectionPlan,
  spliceIdAtOffset,
} from "../../src/io/surgicalInjector";
import { graftTransclusions } from "../../src/ast/transclusionGraft";
import { extractCards } from "../../src/parser/stateMachine";
import { buildVaultFileIndex } from "../../src/obsidian/vaultIndex";
import type { Root } from "mdast";
import type { Node } from "unist";
import { visit } from "unist-util-visit";

const FIXTURES_DIR = join(import.meta.dir, ".");
const VAULT_DIR = join(FIXTURES_DIR, "vault");

const SYNC_ELIGIBLE_FIXTURES = [
  "multi-line-card-layout",
  "stress-test-nested-complex",
  "injection-required-no-ids",
  "deep-transclusion-resolution",
  "malformed-boundary-headings",
  "complex-media-paths",
  "malformed-html-comments",
  "deep-nested-transclusions",
];

const TRANSCLUSION_FIXTURES = new Set([
  "deep-transclusion-resolution",
  "deep-nested-transclusions",
  "stress-test-nested-complex",
]);

async function processFixture(name: string) {
  const rawText = await readFile(join(FIXTURES_DIR, `${name}.md`), "utf8");
  const vaultIndex = await buildVaultFileIndex(VAULT_DIR);
  const ast = parseMarkdown(rawText, VAULT_DIR);

  if (TRANSCLUSION_FIXTURES.has(name)) {
    await graftTransclusions(ast, {
      vaultPath: VAULT_DIR,
      sourcePath: `${name}.md`,
      vaultIndex,
    });
  }

  const cards = extractCards(ast, getDelimiter(rawText, ":::"), {
    bodyStartOffset: getBodyStartOffset(rawText),
    cardDeclarationHeadingLevel: getCardDeclarationHeadingLevel(rawText, 4),
  });
  return { rawText, ast, cards };
}

function assertAstHasPositions(ast: Root): void {
  let withPosition = 0;

  visit(ast, (node: Node) => {
    if (node.type === "root") {
      return;
    }

    if (node.position?.start?.offset !== undefined) {
      withPosition += 1;
    }
  });

  expect(withPosition).toBeGreaterThan(0);
}

describe("astIntegrity", () => {
  test.each(SYNC_ELIGIBLE_FIXTURES)(
    "%s maintains AST position data after processing",
    async (name) => {
      const { ast, cards } = await processFixture(name);
      assertAstHasPositions(ast);
      expect(cards.length).toBeGreaterThan(0);
    },
  );

  test("injection-required-no-ids only adds anki-id comments to raw text", async () => {
    const { rawText, cards } = await processFixture("injection-required-no-ids");

    const plans = cards
      .map((card) => buildInjectionPlan(card))
      .filter((plan): plan is NonNullable<typeof plan> => plan !== undefined);

    expect(plans).toHaveLength(3);

    let injected = rawText;
    const sortedPlans = [...plans].sort((a, b) => b.offset - a.offset);

    for (const plan of sortedPlans) {
      injected = spliceIdAtOffset(injected, plan.offset, plan.uuid);
    }

    for (const plan of plans) {
      expect(injected).toContain(`<!--anki-id: ${plan.uuid}-->`);
    }

    expect(injected.match(/<!--anki-id: [0-9a-f-]+-->/gi)?.length).toBe(3);
    expect(injected).toContain("What is entropy");
    expect(injected).toContain("What is DFS");
    expect(injected).toContain("Transmission Control Protocol");
    expect(injected.length).toBeGreaterThan(rawText.length);
  });
});
