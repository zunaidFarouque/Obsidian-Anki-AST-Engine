import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  assertFixtureMediaReady,
  COMPLEX_MEDIA_FIXTURE_FILES,
  MIN_FIXTURE_MEDIA_BYTES,
} from "./fixtureMedia";
import { stat } from "node:fs/promises";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

describe("fixtureMedia", () => {
  test("complex-media fixture files are real images, not empty placeholders", async () => {
    await assertFixtureMediaReady(FIXTURES_DIR);

    for (const relativePath of COMPLEX_MEDIA_FIXTURE_FILES) {
      const fileStat = await stat(join(FIXTURES_DIR, relativePath));
      expect(fileStat.size).toBeGreaterThanOrEqual(MIN_FIXTURE_MEDIA_BYTES);
    }
  });
});
