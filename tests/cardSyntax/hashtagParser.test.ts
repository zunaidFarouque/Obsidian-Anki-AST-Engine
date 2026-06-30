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

  test("extracts #anki/noteType/<id>", () => {
    expect(parseHeadingHashtags("Word #anki/noteType/My_Vocab")).toEqual({
      userTags: [],
      noteTypeId: "My_Vocab",
      errors: [],
    });
  });

  test("extracts legacy #anki_card_<NoteTypeId>", () => {
    expect(parseHeadingHashtags("D2 Custom legacy tag #anki_card_Vocab")).toEqual({
      userTags: [],
      noteTypeId: "Vocab",
      errors: [],
    });
  });

  test("extracts legacy #anki/CustomCards/<id> as noteType", () => {
    expect(parseHeadingHashtags("Card #anki/CustomCards/Vocab")).toEqual({
      userTags: [],
      noteTypeId: "CustomCards/Vocab",
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
    expect(result.noteTypeId).toBeUndefined();
  });

  test("TAG-02: errors when cardType and #anki/noteType/* appear together", () => {
    const result = parseHeadingHashtags(
      "Bad #anki/cardType/cloze #anki/noteType/Vocab",
    );

    expect(result.errors).toEqual([
      {
        ruleId: "TAG-02",
        message: expect.stringContaining("cardType"),
      },
    ]);
    expect(result.cardType).toBeUndefined();
    expect(result.noteTypeId).toBeUndefined();
  });

  test("TAG-02: errors when cardType and legacy noteType tag appear together", () => {
    const result = parseHeadingHashtags(
      "Bad #anki/cardType/basic #anki_card_Vocab",
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.ruleId).toBe("TAG-02");
    expect(result.cardType).toBeUndefined();
    expect(result.noteTypeId).toBeUndefined();
  });

  test("TAG-04: #anki/noteType/cloze is custom note type id, not built-in cloze", () => {
    expect(
      parseHeadingHashtags("### Section #anki/noteType/cloze"),
    ).toEqual({
      userTags: [],
      noteTypeId: "cloze",
      errors: [],
    });
    expect(
      parseHeadingHashtags("### Section #anki/noteType/cloze").cardType,
    ).toBeUndefined();
  });

  test("TAG-04: noteType id matching builtin name does not trigger TAG-02 alone", () => {
    const result = parseHeadingHashtags("Section #anki/noteType/basic");
    expect(result.noteTypeId).toBe("basic");
    expect(result.cardType).toBeUndefined();
    expect(result.errors).toEqual([]);
  });
});
