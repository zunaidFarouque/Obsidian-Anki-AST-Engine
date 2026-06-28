import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readMarkdownFile } from "../../src/io/reader";

describe("reader", () => {
  test("reads UTF-8 file content with absolute path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "anki-reader-"));
    const filePath = join(dir, "note.md");
    const content = "### Card\n\nFront? Back";
    await writeFile(filePath, content, "utf8");

    const result = await readMarkdownFile(filePath);
    expect(result.absolutePath).toBe(filePath);
    expect(result.rawText).toBe(content);

    await rm(dir, { recursive: true, force: true });
  });
});
