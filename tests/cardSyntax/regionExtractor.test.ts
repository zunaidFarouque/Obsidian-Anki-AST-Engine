import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMarkdown } from "../../src/ast/processor";
import { extractCardRegions } from "../../src/cardSyntax/regionExtractor";
import { nodesToPreview } from "../../src/utils/textPreview";

function parseBody(markdown: string) {
  const ast = parseMarkdown(markdown, "/vault");
  return ast.children;
}

describe("extractCardRegions — DEL-01 standard :::", () => {
  test("splits Text and Back regions at standalone ::: line", () => {
    const regions = extractCardRegions(
      parseBody("Front prose\n\n:::\n\nBack prose"),
    );

    expect(nodesToPreview(regions.textNodes)).toBe("Front prose");
    expect(nodesToPreview(regions.backNodes)).toBe("Back prose");
    expect(regions.regions.delimiters).toEqual([
      expect.objectContaining({ kind: ":::" }),
    ]);
    expect(regions.fields).toHaveLength(0);
  });

  test("does not split mid-line ::: within a paragraph (DEL-01 line-start only)", () => {
    const regions = extractCardRegions(
      parseBody("**Bold** question ::: *Italic* answer"),
    );

    expect(nodesToPreview(regions.textNodes)).toContain("Bold");
    expect(nodesToPreview(regions.textNodes)).toContain("Italic");
    expect(regions.backNodes).toHaveLength(0);
    expect(regions.regions.delimiters).toHaveLength(0);
  });
});

describe("extractCardRegions — DEL-02 reversible :::r", () => {
  test("detects :::r as reversible delimiter", () => {
    const regions = extractCardRegions(
      parseBody("Question prose\n\n:::r\n\nAnswer prose"),
    );

    expect(nodesToPreview(regions.textNodes)).toBe("Question prose");
    expect(nodesToPreview(regions.backNodes)).toBe("Answer prose");
    expect(regions.regions.delimiters[0]).toEqual(
      expect.objectContaining({ kind: ":::r" }),
    );
  });
});

describe("extractCardRegions — DEL-03 typed :::t", () => {
  test("detects :::t as typed delimiter", () => {
    const regions = extractCardRegions(
      parseBody("Capital of France?\n\n:::t\n\nParis"),
    );

    expect(nodesToPreview(regions.textNodes)).toBe("Capital of France?");
    expect(nodesToPreview(regions.backNodes)).toBe("Paris");
    expect(regions.regions.delimiters[0]).toEqual(
      expect.objectContaining({ kind: ":::t" }),
    );
  });
});

describe("extractCardRegions — DEL-04 custom field blocks", () => {
  test("extracts multiple ::: FieldName regions", () => {
    const regions = extractCardRegions(
      parseBody(
        [
          "::: Word",
          "entropy",
          "::: Definition",
          "A measure of energy dispersal.",
        ].join("\n\n"),
      ),
    );

    expect(regions.textNodes).toHaveLength(0);
    expect(regions.backNodes).toHaveLength(0);
    expect(regions.fields).toEqual([
      expect.objectContaining({
        name: "Word",
        nodes: expect.any(Array),
      }),
      expect.objectContaining({
        name: "Definition",
        nodes: expect.any(Array),
      }),
    ]);
    expect(nodesToPreview(regions.fields[0]!.nodes)).toBe("entropy");
    expect(nodesToPreview(regions.fields[1]!.nodes)).toBe(
      "A measure of energy dispersal.",
    );
    expect(regions.regions.delimiters.map((d) => d.kind)).toEqual([
      "field",
      "field",
    ]);
    expect(regions.regions.delimiters[0]?.fieldName).toBe("Word");
    expect(regions.regions.delimiters[1]?.fieldName).toBe("Definition");
  });
});

describe("extractCardRegions — DEL-05 and DEL-06 spaced vs reserved tokens", () => {
  test("::: r is a custom field named r, not reversible (DEL-05, DEL-06)", () => {
    const regions = extractCardRegions(
      parseBody("::: r\n\nContent for field literally named \"r\"."),
    );

    expect(regions.regions.delimiters[0]).toEqual(
      expect.objectContaining({ kind: "field", fieldName: "r" }),
    );
    expect(regions.regions.delimiters[0]?.kind).not.toBe(":::r");
    expect(nodesToPreview(regions.fields[0]!.nodes)).toContain(
      'Content for field literally named "r"',
    );
  });

  test(":::r without space is reversible token (DEL-06)", () => {
    const regions = extractCardRegions(
      parseBody("Symbol for gold?\n\n:::r\n\nAu"),
    );

    expect(regions.regions.delimiters[0]?.kind).toBe(":::r");
    expect(nodesToPreview(regions.backNodes)).toBe("Au");
  });
});

describe("extractCardRegions — DEL-07 delimiters ignored in code and math", () => {
  test("ignores ::: inside fenced code block", async () => {
    const fixture = await readFile(
      join(import.meta.dir, "../fixtures/edge-case-delimiters-triple-colon.md"),
      "utf8",
    );
    const regions = extractCardRegions(parseBody(fixture));

    expect(nodesToPreview(regions.textNodes)).toContain("snippets");
    expect(nodesToPreview(regions.backNodes)).toContain(
      "should start the back",
    );
    expect(regions.regions.delimiters).toHaveLength(1);
    expect(regions.regions.delimiters[0]?.kind).toBe(":::");
  });

  test("ignores ::: inside fenced code per DEL-07 spec shape", () => {
    const regions = extractCardRegions(
      parseBody(
        ["```python", 'print(":::")', "```", ":::", "Real back"].join("\n"),
      ),
    );

    expect(regions.textNodes.some((node) => node.type === "code")).toBe(true);
    expect(nodesToPreview(regions.backNodes)).toBe("Real back");
    expect(regions.regions.delimiters).toHaveLength(1);
  });

  test("ignores ::: inside display math", () => {
    const regions = extractCardRegions(
      parseBody(
        [
          "Front text",
          "$$",
          "x ::: y",
          "$$",
          ":::",
          "Real back",
        ].join("\n\n"),
      ),
    );

    expect(nodesToPreview(regions.textNodes)).toBe("Front text");
    expect(nodesToPreview(regions.backNodes)).toContain("Real back");
    expect(regions.regions.delimiters).toHaveLength(1);
  });
});

describe("extractCardRegions — DEL-08 first structural split wins", () => {
  test("second ::: remains in Back region content", () => {
    const regions = extractCardRegions(
      parseBody(
        [
          "Front",
          ":::",
          "Back line 1",
          ":::",
          "This is still back content (not a third field).",
        ].join("\n\n"),
      ),
    );

    expect(nodesToPreview(regions.textNodes)).toBe("Front");
    expect(nodesToPreview(regions.backNodes)).toContain("Back line 1");
    expect(nodesToPreview(regions.backNodes)).toContain(
      "This is still back content (not a third field).",
    );
    expect(regions.regions.delimiters).toHaveLength(1);
    expect(regions.regions.delimiters[0]?.kind).toBe(":::");
  });
});

describe("extractCardRegions — no delimiter", () => {
  test("puts all body content in Text region when no delimiter", () => {
    const regions = extractCardRegions(
      parseBody("Only front prose, no delimiter."),
    );

    expect(nodesToPreview(regions.textNodes)).toBe(
      "Only front prose, no delimiter.",
    );
    expect(regions.backNodes).toHaveLength(0);
    expect(regions.regions.delimiters).toHaveLength(0);
    expect(regions.regions.text).toBeDefined();
    expect(regions.regions.back).toBeUndefined();
  });
});
