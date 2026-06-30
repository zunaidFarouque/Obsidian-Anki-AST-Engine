import { describe, expect, test } from "bun:test";
import { parseHeadingHashtags } from "../../src/cardSyntax/hashtagParser";

describe("hashtagParser", () => {
  test("returns empty result for heading text without hashtags", () => {
    expect(parseHeadingHashtags("Plain heading")).toEqual({
      userTags: [],
      errors: [],
    });
  });

  test("collects user tags without hash prefix", () => {
    expect(parseHeadingHashtags("Thermodynamics #biology #exam-prep")).toEqual({
      userTags: ["biology", "exam-prep"],
      errors: [],
    });
  });

  test("extracts #anki/cardType for each built-in type", () => {
    expect(
      parseHeadingHashtags("Card #anki/cardType/basic").cardType,
    ).toBe("basic");
    expect(
      parseHeadingHashtags("Card #anki/cardType/cloze").cardType,
    ).toBe("cloze");
    expect(
      parseHeadingHashtags("Card #anki/cardType/reversible").cardType,
    ).toBe("reversible");
    expect(
      parseHeadingHashtags("Card #anki/cardType/typed").cardType,
    ).toBe("typed");
  });

  test("strips cardType engine directives from user tags", () => {
    expect(parseHeadingHashtags("### Thermodynamics #biology #anki/cardType/cloze")).toEqual({
      userTags: ["biology"],
      cardType: "cloze",
      errors: [],
    });
  });

  test("extracts #anki/model/<id>", () => {
    expect(parseHeadingHashtags("Word #anki/model/My_Vocab")).toEqual({
      userTags: [],
      model: "My_Vocab",
      errors: [],
    });
  });

  test("extracts legacy #anki_card_<ModelId>", () => {
    expect(parseHeadingHashtags("D2 Custom legacy tag #anki_card_Vocab")).toEqual({
      userTags: [],
      model: "Vocab",
      errors: [],
    });
  });

  test("extracts legacy #anki/CustomCards/<id> as model", () => {
    expect(parseHeadingHashtags("Card #anki/CustomCards/Vocab")).toEqual({
      userTags: [],
      model: "CustomCards/Vocab",
      errors: [],
    });
  });

  test("TAG-01: errors on multiple #anki/cardType/* tags", () => {
    const result = parseHeadingHashtags(
      "Bad #anki/cardType/cloze #anki/cardType/basic",
    );

    expect(result.errors).toEqual([
      {
        ruleId: "TAG-01",
        message: expect.stringContaining("cardType"),
      },
    ]);
    expect(result.cardType).toBeUndefined();
    expect(result.model).toBeUndefined();
  });

  test("TAG-02: errors when cardType and #anki/model/* appear together", () => {
    const result = parseHeadingHashtags(
      "Bad #anki/cardType/cloze #anki/model/Vocab",
    );

    expect(result.errors).toEqual([
      {
        ruleId: "TAG-02",
        message: expect.stringContaining("cardType"),
      },
    ]);
    expect(result.cardType).toBeUndefined();
    expect(result.model).toBeUndefined();
  });

  test("TAG-02: errors when cardType and legacy model tag appear together", () => {
    const result = parseHeadingHashtags(
      "Bad #anki/cardType/basic #anki_card_Vocab",
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.ruleId).toBe("TAG-02");
    expect(result.cardType).toBeUndefined();
    expect(result.model).toBeUndefined();
  });

  test("TAG-04: treats #anki/noteType/* as user tag, not cardType", () => {
    expect(
      parseHeadingHashtags("### Invalid noteType tag #anki/noteType/cloze"),
    ).toEqual({
      userTags: ["anki/noteType/cloze"],
      errors: [],
    });
  });

  test("TAG-04: noteType tag does not trigger TAG-02 with cardType", () => {
    expect(
      parseHeadingHashtags(
        "Section #anki/cardType/basic #anki/noteType/cloze",
      ),
    ).toEqual({
      userTags: ["anki/noteType/cloze"],
      cardType: "basic",
      errors: [],
    });
  });
});
