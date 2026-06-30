import { readFile } from "node:fs/promises";
import { join } from "node:path";

const STRESS_TEST_FIXTURE = join(
  import.meta.dir,
  "../../tests/fixtures/new format/card-syntax-stress-test.md",
);

const ORPHAN_CUSTOM_FIXTURE = join(
  import.meta.dir,
  "../../tests/fixtures/new format/card-syntax-orphan-custom.md",
);

export async function loadCardSyntaxStressTest(): Promise<string> {
  return readFile(STRESS_TEST_FIXTURE, "utf8");
}

export async function loadCardSyntaxOrphanCustom(): Promise<string> {
  return readFile(ORPHAN_CUSTOM_FIXTURE, "utf8");
}

export function stressTestFixturePath(): string {
  return STRESS_TEST_FIXTURE;
}

export function orphanCustomFixturePath(): string {
  return ORPHAN_CUSTOM_FIXTURE;
}
