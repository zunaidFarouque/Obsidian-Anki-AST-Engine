import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FIXTURES_DIR = join(import.meta.dir);
const VALID_ANKI_ID_PATTERN = /<!--anki-id:\s*[0-9a-f-]+-->/i;

const ID_FREE_FIXTURES = [
  "injection-required-no-ids.md",
  "malformed-boundary-headings.md",
  "malformed-html-comments.md",
];

describe("fixture id-free integrity", () => {
  for (const fixtureName of ID_FREE_FIXTURES) {
    test(`${fixtureName} does not contain injected anki-id comments`, async () => {
      const content = await readFile(join(FIXTURES_DIR, fixtureName), "utf8");
      expect(content).not.toMatch(VALID_ANKI_ID_PATTERN);
    });
  }
});
