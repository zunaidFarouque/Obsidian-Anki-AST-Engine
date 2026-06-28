import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildInjectionPlan,
  spliceIdAtOffset,
} from "../../src/io/surgicalInjector";
import type { ExtractedCard } from "../../src/parser/stateMachine";

describe("surgicalInjector", () => {
  test("splices anki-id comment at exact offset without mutating other content", async () => {
    const rawText = await readFile(
      join(import.meta.dir, "../fixtures/missing-id-injection.md"),
      "utf8",
    );
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const offset = rawText.indexOf("Randomness.") + "Randomness.".length;

    const result = spliceIdAtOffset(rawText, offset, uuid);

    expect(result).toContain(`<!--anki-id: ${uuid}-->`);
    expect(result).toContain("### Entropy Measure of disorder? ::: Randomness.");
    expect(result).toContain("### Next");
    expect(result.indexOf("### Next")).toBeGreaterThan(
      result.indexOf(`<!--anki-id: ${uuid}-->`),
    );
    expect(result.length).toBe(
      rawText.length + `\n<!--anki-id: ${uuid}-->\n`.length,
    );
  });

  test("buildInjectionPlan returns offset and uuid for cards lacking id", () => {
    const card: ExtractedCard = {
      tag: "Entropy",
      frontNodes: [],
      backNodes: [],
      injectionOffset: 42,
    };

    const plan = buildInjectionPlan(card);
    expect(plan).toBeDefined();
    expect(plan?.offset).toBe(42);
    expect(plan?.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  test("buildInjectionPlan returns undefined when card already has anki-id", () => {
    const card: ExtractedCard = {
      tag: "Physics",
      frontNodes: [],
      backNodes: [],
      ankiId: "550e8400-e29b-41d4-a716-446655440000",
      injectionOffset: 42,
    };

    expect(buildInjectionPlan(card)).toBeUndefined();
  });
});
