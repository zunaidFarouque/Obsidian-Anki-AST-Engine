import { describe, expect, test } from "bun:test";
import {
  disambiguateRemoteFileName,
  fileNameFromRemoteUrl,
  isRemoteMediaUrl,
} from "../../src/anki/mediaTransport";
import { MEDIA_HASH_SEPARATOR } from "../../src/anki/mediaNaming";

describe("isRemoteMediaUrl", () => {
  test("detects http and https URLs", () => {
    expect(isRemoteMediaUrl("https://example.com/a.png")).toBe(true);
    expect(isRemoteMediaUrl("http://example.com/a.png")).toBe(true);
    expect(isRemoteMediaUrl("assets/photo.png")).toBe(false);
    expect(isRemoteMediaUrl("./photo.png")).toBe(false);
  });
});

describe("fileNameFromRemoteUrl", () => {
  test("uses URL basename sanitized for Anki", () => {
    expect(fileNameFromRemoteUrl(
      "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png",
    )).toBe("PNG_transparency_demonstration_1.png");
  });

  test("defaults extension when URL path has no extension", () => {
    expect(fileNameFromRemoteUrl("https://example.com/photo")).toBe("photo.png");
  });
});

describe("disambiguateRemoteFileName", () => {
  test("adds hash suffix when two URLs share basename", () => {
    const seen = new Map<string, string>();
    const first = disambiguateRemoteFileName(
      "photo.png",
      "https://a.example/photo.png",
      seen,
    );
    const second = disambiguateRemoteFileName(
      "photo.png",
      "https://b.example/photo.png",
      seen,
    );

    expect(first).toBe("photo.png");
    expect(second).toContain(MEDIA_HASH_SEPARATOR);
    expect(second).not.toBe(first);
  });
});
