import { describe, expect, test } from "bun:test";
import { hashContent } from "../../src/utils/hash";

describe("hash", () => {
  test("returns deterministic SHA-256 hex digest", () => {
    const input = "hello world";
    const expected =
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
    expect(hashContent(input)).toBe(expected);
    expect(hashContent(input)).toBe(hashContent(input));
  });

  test("produces different hashes for different content", () => {
    expect(hashContent("a")).not.toBe(hashContent("b"));
  });
});
