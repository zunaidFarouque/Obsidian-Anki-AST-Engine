import { describe, expect, test } from "bun:test";
import { toAnkiMediaFileName } from "../../src/anki/mediaFileName";

describe("toAnkiMediaFileName", () => {
  test("replaces spaces with underscores for Anki collection filenames", () => {
    expect(toAnkiMediaFileName("Cell Diagram final.png")).toBe(
      "Cell_Diagram_final.png",
    );
  });

  test("leaves filenames without spaces unchanged", () => {
    expect(toAnkiMediaFileName("path.png")).toBe("path.png");
  });
});
