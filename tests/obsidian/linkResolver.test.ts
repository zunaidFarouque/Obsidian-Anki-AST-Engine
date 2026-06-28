import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  parseLinktext,
  getFirstLinkpathDest,
  resolveSubpath,
} from "../../src/obsidian/linkResolver";
import { buildVaultFileIndex } from "../../src/obsidian/vaultIndex";

const PARITY_VAULT = join(import.meta.dir, "../fixtures/obsidian-parity/vault");

describe("parseLinktext", () => {
  test("parses path, heading subpath, and display alias", () => {
    const result = parseLinktext("Note#Heading|Display", false);
    expect(result).toEqual({
      path: "Note",
      subpath: "#Heading",
      displayText: "Display",
      isEmbed: false,
    });
  });

  test("parses block subpath", () => {
    const result = parseLinktext("Note#^block-id", true);
    expect(result.path).toBe("Note");
    expect(result.subpath).toBe("#^block-id");
    expect(result.isEmbed).toBe(true);
  });

  test("parses same-note block reference", () => {
    const result = parseLinktext("#^quote-id", true);
    expect(result.path).toBe("");
    expect(result.subpath).toBe("#^quote-id");
  });

  test("strips width alias from media embeds", () => {
    const result = parseLinktext("image.png|300", true);
    expect(result.path).toBe("image.png");
    expect(result.displayText).toBe("300");
  });
});

describe("getFirstLinkpathDest", () => {
  test("resolves unique basename at vault root", async () => {
    const index = await buildVaultFileIndex(PARITY_VAULT);
    const dest = getFirstLinkpathDest(
      "My Note",
      "folder/a.md",
      index,
    );
    expect(dest).toBe("My Note.md");
  });

  test("resolves relative parent path", async () => {
    const index = await buildVaultFileIndex(PARITY_VAULT);
    const dest = getFirstLinkpathDest(
      "../sibling",
      "deep/nested/note.md",
      index,
    );
    expect(dest).toBe("deep/sibling.md");
  });

  test("returns null for ambiguous basename", async () => {
    const index = await buildVaultFileIndex(PARITY_VAULT);
    const dest = getFirstLinkpathDest("Note", "folder/a.md", index);
    expect(dest).toBeNull();
  });

  test("returns source path for same-note subpath-only link", async () => {
    const index = await buildVaultFileIndex(PARITY_VAULT);
    const dest = getFirstLinkpathDest(
      "",
      "embed-same-note.md",
      index,
    );
    expect(dest).toBe("embed-same-note.md");
  });
});

describe("resolveSubpath", () => {
  test("resolves heading section", async () => {
    const index = await buildVaultFileIndex(PARITY_VAULT);
    const filePath = "SectionSource.md";
    const cache = index.fileCaches.get(filePath);
    expect(cache).toBeDefined();

    const nodes = resolveSubpath(cache!, "#Kinematics");
    const text = nodes?.map(collectText).join("") ?? "";
    expect(text).toContain("Motion in one dimension");
    expect(text).not.toContain("Forces and acceleration");
  });

  test("resolves block id subpath", async () => {
    const index = await buildVaultFileIndex(PARITY_VAULT);
    const cache = index.fileCaches.get("Target.md");
    const nodes = resolveSubpath(cache!, "#^singleton");
    const text = nodes?.map(collectText).join("") ?? "";
    expect(text).toContain("singleton pattern");
    expect(text).not.toContain("^singleton");
  });
});

function collectText(node: { type: string; value?: string; children?: unknown[] }): string {
  if (node.type === "text" && node.value) {
    return node.value;
  }
  if (!node.children) {
    return "";
  }
  return (node.children as typeof node[]).map(collectText).join("");
}
