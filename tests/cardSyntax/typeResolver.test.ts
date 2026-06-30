import { describe, expect, test } from "bun:test";
import {
  resolveCardType,
  type TypeResolverContext,
} from "../../src/cardSyntax/typeResolver";

function ctx(
  overrides: Partial<TypeResolverContext> = {},
): TypeResolverContext {
  return {
    cardHeading: { headingLevel: 4, headingTitle: "Card" },
    ancestors: [],
    textRegion: "",
    hasFieldBlocks: false,
    hasReversibleDelimiter: false,
    hasTypedDelimiter: false,
    frontmatter: {},
    ...overrides,
  };
}

describe("resolveCardType — RES-01 card heading wins", () => {
  test("card heading #anki/cardType/basic overrides ancestor cloze", () => {
    const result = resolveCardType(
      ctx({
        cardHeading: {
          headingLevel: 4,
          headingTitle: "Override",
          builtinType: "basic",
        },
        ancestors: [
          {
            headingLevel: 3,
            headingTitle: "Section",
            builtinType: "cloze",
          },
        ],
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "basic",
      resolvedFrom: "card heading #anki/cardType/basic",
    });
  });

  test("card heading model overrides section builtin", () => {
    const result = resolveCardType(
      ctx({
        cardHeading: {
          headingLevel: 4,
          headingTitle: "Term",
          modelId: "Vocab",
        },
        ancestors: [
          {
            headingLevel: 3,
            headingTitle: "Chapter",
            builtinType: "cloze",
          },
        ],
        hasFieldBlocks: true,
        frontmatter: { anki_customCardDefault: "Other" },
      }),
    );

    expect(result).toEqual({
      kind: "custom",
      modelId: "Vocab",
      resolvedFrom: "card heading #anki/model/Vocab",
    });
  });
});

describe("resolveCardType — RES-02 outline parent chain", () => {
  test("sibling section does not inherit cloze from unrelated ancestor", () => {
    const result = resolveCardType(
      ctx({
        ancestors: [
          {
            headingLevel: 2,
            headingTitle: "Unit B",
            builtinType: "basic",
          },
        ],
        textRegion: "What is entropy?",
        hasReversibleDelimiter: false,
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "basic",
      resolvedFrom: "inherited from ## Unit B",
    });
  });
});

describe("resolveCardType — RES-03 nearest ancestor wins", () => {
  test("stops at nearest ancestor with type tag", () => {
    const result = resolveCardType(
      ctx({
        ancestors: [
          {
            headingLevel: 3,
            headingTitle: "Section",
            builtinType: "cloze",
          },
          {
            headingLevel: 2,
            headingTitle: "Chapter",
            builtinType: "basic",
          },
        ],
        textRegion: "{{hidden}}",
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "cloze",
      resolvedFrom: "inherited from ### Section",
    });
  });
});

describe("resolveCardType — RES-04 custom default is layout-triggered", () => {
  test("anki_customCardDefault applies with ::: Field blocks", () => {
    const result = resolveCardType(
      ctx({
        hasFieldBlocks: true,
        frontmatter: { anki_customCardDefault: "Vocab" },
      }),
    );

    expect(result).toEqual({
      kind: "custom",
      modelId: "Vocab",
      resolvedFrom: "anki_customCardDefault: Vocab",
    });
  });

  test("anki_customCardDefault ignored without field blocks", () => {
    const result = resolveCardType(
      ctx({
        hasFieldBlocks: false,
        frontmatter: { anki_customCardDefault: "Vocab" },
        textRegion: "Plain question",
        hasReversibleDelimiter: true,
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "reversible",
      resolvedFrom: "delimiter :::r",
    });
  });
});

describe("resolveCardType — RES-05 delimiter sets type when unresolved", () => {
  test(":::r resolves reversible", () => {
    const result = resolveCardType(
      ctx({
        hasReversibleDelimiter: true,
        textRegion: "Question",
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "reversible",
      resolvedFrom: "delimiter :::r",
    });
  });

  test(":::t resolves typed", () => {
    const result = resolveCardType(
      ctx({
        hasTypedDelimiter: true,
        textRegion: "Question",
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "typed",
      resolvedFrom: "delimiter :::t",
    });
  });

  test("does not override inherited cloze — layout validation handles :::r conflict", () => {
    const result = resolveCardType(
      ctx({
        ancestors: [
          {
            headingLevel: 3,
            headingTitle: "Cloze section",
            builtinType: "cloze",
          },
        ],
        hasReversibleDelimiter: true,
        textRegion: "Inherited {{token}}",
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "cloze",
      resolvedFrom: "inherited from ### Cloze section",
    });
  });
});

describe("resolveCardType — RES-06 cloze inference", () => {
  test("{{cN::...}} in Text region infers cloze when unresolved", () => {
    const result = resolveCardType(
      ctx({
        textRegion: "The {{c1::mitochondria}} produces ATP.",
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "cloze",
      resolvedFrom: "inferred from {{cN::...}} in Text",
    });
  });

  test("does not infer cloze when basic already resolved from anki_cardDefault", () => {
    const result = resolveCardType(
      ctx({
        textRegion: "The {{c1::mitochondria}} is important.",
        frontmatter: { anki_cardDefault: "basic" },
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "basic",
      resolvedFrom: "anki_cardDefault: basic",
    });
  });

  test("reclassifies basic to cloze when inferClozeFromManualSyntaxOnBasic is true", () => {
    const result = resolveCardType(
      ctx({
        textRegion: "The {{c1::mitochondria}} is important.",
        frontmatter: { anki_cardDefault: "basic" },
        inferClozeFromManualSyntaxOnBasic: true,
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "cloze",
      resolvedFrom: "inferred from {{cN::...}} in Text (reclassified from basic)",
    });
  });
});

describe("resolveCardType — RES-07 final fallback", () => {
  test("plain front/back card resolves basic", () => {
    const result = resolveCardType(
      ctx({
        textRegion: "What is H₂O?",
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "basic",
      resolvedFrom: "default basic",
    });
  });
});

describe("resolveCardType — RES-08 model tags inherit on sections", () => {
  test("inherits custom model from ancestor section", () => {
    const result = resolveCardType(
      ctx({
        ancestors: [
          {
            headingLevel: 3,
            headingTitle: "Vocabulary",
            modelId: "Vocab",
          },
        ],
        hasFieldBlocks: true,
      }),
    );

    expect(result).toEqual({
      kind: "custom",
      modelId: "Vocab",
      resolvedFrom: "inherited from ### Vocabulary",
    });
  });
});

describe("resolveCardType — RES-04 anki_cardDefault", () => {
  test("anki_cardDefault applies when earlier steps do not resolve", () => {
    const result = resolveCardType(
      ctx({
        frontmatter: { anki_cardDefault: "cloze" },
        textRegion: "Some text",
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "cloze",
      resolvedFrom: "anki_cardDefault: cloze",
    });
  });

  test("anki_cardDefault defers to :::r delimiter per FM-02 and RES-05", () => {
    const result = resolveCardType(
      ctx({
        hasReversibleDelimiter: true,
        frontmatter: { anki_cardDefault: "basic" },
        textRegion: "Question",
      }),
    );

    expect(result).toEqual({
      kind: "builtin",
      type: "reversible",
      resolvedFrom: "delimiter :::r",
    });
  });
});
