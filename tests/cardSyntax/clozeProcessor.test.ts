import { describe, expect, test } from "bun:test";
import { processClozeDeletions } from "../../src/cardSyntax/clozeProcessor";

describe("clozeProcessor", () => {
  describe("CLZ-03 — manual cloze form", () => {
    test("preserves manual numbers and emits canonical form", () => {
      const result = processClozeDeletions(
        "{{c1::mitochondria}} and {{c2::ATP::energy molecule}}",
        { allowShorthand: true },
      );

      expect(result.valid).toBe(true);
      expect(result.text).toBe(
        "{{c1::mitochondria}} and {{c2::ATP::energy molecule}}",
      );
    });

    test("parses manual form when shorthand is disabled", () => {
      const result = processClozeDeletions("{{c1::mitochondria}}", {
        allowShorthand: false,
      });

      expect(result.valid).toBe(true);
      expect(result.text).toBe("{{c1::mitochondria}}");
    });
  });

  describe("CLZ-04 — shorthand (explicit cloze type only)", () => {
    test("auto-numbers shorthand when allowShorthand is true", () => {
      const result = processClozeDeletions(
        "The {{mitochondria}} is the {{powerhouse::organelle}} of the cell.",
        { allowShorthand: true },
      );

      expect(result.valid).toBe(true);
      expect(result.text).toBe(
        "The {{c1::mitochondria}} is the {{c2::powerhouse::organelle}} of the cell.",
      );
    });

    test("leaves shorthand literal when allowShorthand is false", () => {
      const result = processClozeDeletions("The {{mitochondria}} cell.", {
        allowShorthand: false,
      });

      expect(result.valid).toBe(true);
      expect(result.text).toBe("The {{mitochondria}} cell.");
    });
  });

  describe("CLZ-05 — auto-numbering algorithm", () => {
    test("groups case-insensitive text and assigns sequential numbers", () => {
      const result = processClozeDeletions(
        "{{Java}} ... {{java}} ... {{Python}}",
        { allowShorthand: true },
      );

      expect(result.valid).toBe(true);
      expect(result.text).toBe(
        "{{c1::Java}} ... {{c1::java}} ... {{c2::Python}}",
      );
    });

    test("respects manual numbers when assigning auto groups", () => {
      const result = processClozeDeletions(
        "{{c3::foo}} and {{bar}} and {{c1::baz}}",
        { allowShorthand: true },
      );

      expect(result.valid).toBe(true);
      expect(result.text).toBe(
        "{{c3::foo}} and {{c2::bar}} and {{c1::baz}}",
      );
    });
  });

  describe("CLZ-06 — hints and grouping", () => {
    test("first hint wins for same normalized group", () => {
      const result = processClozeDeletions("{{bank}} ... {{bank::river edge}}", {
        allowShorthand: true,
      });

      expect(result.valid).toBe(true);
      expect(result.text).toBe("{{c1::bank}} ... {{c1::bank}}");
      expect(result.warnings).toContain(
        "Hint mismatch for cloze c1: later hint ignored",
      );
    });
  });

  describe("CLZ-07 — manual + auto merge", () => {
    test("merges auto shorthand into existing manual group", () => {
      const result = processClozeDeletions("{{c1::foo}} ... {{foo}}", {
        allowShorthand: true,
      });

      expect(result.valid).toBe(true);
      expect(result.text).toBe("{{c1::foo}} ... {{c1::foo}}");
    });
  });

  describe("CLZ-08 — intentional duplicate manual groups", () => {
    test("keeps separate manual numbers for same text", () => {
      const result = processClozeDeletions(
        "First {{c1::ATP}} and second {{c2::ATP}} are separate.",
        { allowShorthand: true },
      );

      expect(result.valid).toBe(true);
      expect(result.text).toBe(
        "First {{c1::ATP}} and second {{c2::ATP}} are separate.",
      );
    });
  });

  describe("CLZ-09 — empty deletion", () => {
    test("marks {{}} as invalid", () => {
      const result = processClozeDeletions("Nothing valid here {{}}.", {
        allowShorthand: true,
      });

      expect(result.valid).toBe(false);
    });

    test("marks {{c1::}} with empty text as invalid", () => {
      const result = processClozeDeletions("Bad {{c1::}} here.", {
        allowShorthand: true,
      });

      expect(result.valid).toBe(false);
    });

    test("marks whitespace-only text as invalid", () => {
      const result = processClozeDeletions("Bad {{   }} here.", {
        allowShorthand: true,
      });

      expect(result.valid).toBe(false);
    });
  });
});
