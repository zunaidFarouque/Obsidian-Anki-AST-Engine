import { describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../src/config/configParser";
import { runSync, type SyncAction } from "../src/syncPipeline";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

const baseConfig = {
  ankiConnectUrl: "http://127.0.0.1:8765",
  linkFormat: "shortest" as const,
  defaultCardDeclarationHeadingLevel: 4,
  includeParentHeadersAsTags: true,
  defaultEngineTag: "Obsidian-Anki-AST",
};

function findByTag(actions: SyncAction[], suffix: string): SyncAction {
  const action = actions.find((entry) => entry.tag.endsWith(`::${suffix}`));
  expect(action).toBeDefined();
  return action!;
}

describe("syncPipeline stress fixture", () => {
  test("card-feature-stress-test dry-run compiles all 14 cards with expected HTML", async () => {
    const root = await mkdtemp(join(tmpdir(), "anki-stress-"));
    const vaultPath = join(root, "vault");
    const notesDir = join(vaultPath, "Notes");
    await mkdir(notesDir, { recursive: true });

    await copyFile(
      join(FIXTURES_DIR, "card-feature-stress-test.md"),
      join(notesDir, "card-feature-stress-test.md"),
    );
    await copyFile(join(FIXTURES_DIR, "embed_me.md"), join(notesDir, "embed_me.md"));

    const config: Config = {
      vaultPath,
      delimiter: ":::",
      scanFolders: ["Notes"],
      defaultAnkiDeck: "Stress::Deck",
      ...baseConfig,
    };

    const { actions } = await runSync(config, { dryRun: true });

    expect(actions).toHaveLength(14);

    for (const action of actions) {
      expect(action.frontHtml).toMatch(
        /<p>|<h2>|math-inline|callout|should be visible/i,
      );
      expect(action.backHtml.length).toBeGreaterThan(0);
    }

    const rich = findByTag(actions, "Rich Formatting Baseline");
    expect(rich.frontHtml).toContain("entropy in thermodynamics");
    expect(rich.frontHtml).toContain("<br>");
    expect(rich.backHtml).toContain("<h2>Preview section title</h2>");
    expect(rich.backHtml).toContain("<mark>highlighted</mark>");
    expect(rich.backHtml).toContain('print(":::")');

    const inlineMath = findByTag(actions, "Inline Math On Front");
    expect(inlineMath.frontHtml).toContain("\\(F=ma\\)");
    expect(inlineMath.backHtml).not.toContain("\\(F=ma\\)");

    const displayMath = findByTag(actions, "Display Math On Back");
    expect(displayMath.frontHtml).not.toMatch(/\\\[|\\int/);
    expect(displayMath.backHtml).toMatch(/\\\[|\\int/);

    const footnotesA = findByTag(actions, "Footnotes Set A");
    expect(footnotesA.frontHtml).toContain("<sup>1</sup>");
    expect(footnotesA.frontHtml).toContain("<sup>2</sup>");
    expect(footnotesA.frontHtml).toContain("<hr>");
    expect(footnotesA.frontHtml).toContain("First footnote definition for set A");
    expect(footnotesA.backHtml).toContain("<hr>");
    expect(footnotesA.backHtml).toContain("First footnote definition for set A");
    expect(footnotesA.backHtml).not.toContain("[^note-a]:");

    const footnotesB = findByTag(actions, "Footnotes Set B");
    expect(footnotesB.frontHtml).toContain("<hr>");
    expect(footnotesB.backHtml).toContain("<hr>");
    expect(footnotesB.backHtml).toContain("Footnote definition for set B");

    const callouts = findByTag(actions, "Callouts Only");
    expect(callouts.backHtml).toContain('class="callout callout-note"');
    expect(callouts.backHtml).toContain('class="callout callout-warning"');
    expect(callouts.backHtml).toContain("Custom warning title");

    const transclusionFront = findByTag(actions, "Transclusion On Front");
    expect(transclusionFront.frontHtml).toContain("should be visible");
    expect(transclusionFront.frontHtml).toContain("callout-tip");
    expect(transclusionFront.frontHtml).not.toContain("should not be visible");
    expect(transclusionFront.transclusionResolved).toBe(true);

    const transclusionBack = findByTag(actions, "Transclusion On Back");
    expect(transclusionBack.backHtml).toContain("should be visible");
    expect(transclusionBack.backHtml).not.toContain("should not be visible");

    const embedMath = findByTag(actions, "Embed Plus Math");
    expect(embedMath.frontHtml).toContain("should be visible");
    expect(embedMath.frontHtml).toContain("\\(E=mc^2\\)");
    expect(embedMath.frontHtml).toContain("<hr>");
    expect(embedMath.frontHtml).toContain("Footnote on embed-plus-math card back");
    expect(embedMath.backHtml).not.toContain("<hr>");
    expect(embedMath.backHtml).toMatch(/\\\[|\\sum/);

    const kitchenSink = findByTag(actions, "Kitchen Sink");
    expect(kitchenSink.frontHtml).toContain("<br>");
    expect(kitchenSink.backHtml).toContain("<h2>Kitchen sink answer</h2>");
    expect(kitchenSink.backHtml).toContain('class="callout callout-tip"');
    expect(kitchenSink.backHtml).toContain("<hr>");
    expect(kitchenSink.backHtml).toMatch(/\\\[|\\int/);

    const headingFront = findByTag(actions, "Heading Is The Front");
    expect(headingFront.frontHtml).toContain("Heading Is The Front");
    expect(headingFront.backHtml).toContain("Back paragraph one");

    const legacyDelimiter = findByTag(actions, "Legacy Delimiter In Prose");
    expect(legacyDelimiter.frontHtml).toContain("CS101::Week 2::Entropy");
    expect(legacyDelimiter.backHtml).toContain("Normal back content");

    const mathDelimiter = findByTag(actions, "Math Delimiter In Display");
    expect(mathDelimiter.backHtml).toMatch(/\\\[|:::/);
    expect(mathDelimiter.tag).toContain("Math Delimiter In Display");

    await rm(root, { recursive: true, force: true });
  });
});
