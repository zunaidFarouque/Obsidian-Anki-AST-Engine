export type BuiltinCardType = "basic" | "cloze" | "reversible" | "typed";

export interface HeadingTypeDeclaration {
  headingTitle?: string;
  headingLevel: number;
  builtinType?: BuiltinCardType;
  noteTypeId?: string;
}

export interface TypeResolverContext {
  cardHeading: HeadingTypeDeclaration;
  /** Nearest ancestor first (immediate parent section, then next, etc.). */
  ancestors: HeadingTypeDeclaration[];
  /** Card body content before the first structural delimiter. */
  textRegion: string;
  hasFieldBlocks: boolean;
  hasReversibleDelimiter: boolean;
  hasTypedDelimiter: boolean;
  frontmatter?: {
    anki_cardDefault?: BuiltinCardType;
    anki_customCardDefault?: string;
  };
  inferClozeFromManualSyntaxOnBasic?: boolean;
}

export type ResolvedCardType =
  | { kind: "builtin"; type: BuiltinCardType; resolvedFrom: string }
  | { kind: "custom"; noteTypeId: string; resolvedFrom: string };

const MANUAL_CLOZE_PATTERN = /\{\{c\d+::/;

function headingLabel(heading: HeadingTypeDeclaration): string {
  const hashes = "#".repeat(heading.headingLevel);
  const title = heading.headingTitle ?? "heading";
  return `${hashes} ${title}`;
}

function resolveFromCardHeading(
  heading: HeadingTypeDeclaration,
): ResolvedCardType | undefined {
  if (heading.noteTypeId) {
    return {
      kind: "custom",
      noteTypeId: heading.noteTypeId,
      resolvedFrom: `card heading #anki/noteType/${heading.noteTypeId}`,
    };
  }
  if (heading.builtinType) {
    return {
      kind: "builtin",
      type: heading.builtinType,
      resolvedFrom: `card heading #anki/cardType/${heading.builtinType}`,
    };
  }
  return undefined;
}

function resolveFromAncestor(
  ancestor: HeadingTypeDeclaration,
): ResolvedCardType | undefined {
  const source = `inherited from ${headingLabel(ancestor)}`;
  if (ancestor.noteTypeId) {
    return { kind: "custom", noteTypeId: ancestor.noteTypeId, resolvedFrom: source };
  }
  if (ancestor.builtinType) {
    return {
      kind: "builtin",
      type: ancestor.builtinType,
      resolvedFrom: source,
    };
  }
  return undefined;
}

function findNearestAncestorType(
  ancestors: HeadingTypeDeclaration[],
): ResolvedCardType | undefined {
  for (const ancestor of ancestors) {
    const resolved = resolveFromAncestor(ancestor);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

function hasManualClozeSyntax(textRegion: string): boolean {
  return MANUAL_CLOZE_PATTERN.test(textRegion);
}

function inferClozeFromText(
  textRegion: string,
  reclassified: boolean,
): ResolvedCardType {
  return {
    kind: "builtin",
    type: "cloze",
    resolvedFrom: reclassified
      ? "inferred from {{cN::...}} in Text (reclassified from basic)"
      : "inferred from {{cN::...}} in Text",
  };
}

/**
 * Resolution ladder per RES-01..RES-09.
 */
export function resolveCardType(context: TypeResolverContext): ResolvedCardType {
  const fromCard = resolveFromCardHeading(context.cardHeading);
  if (fromCard) {
    return fromCard;
  }

  const fromAncestor = findNearestAncestorType(context.ancestors);
  if (fromAncestor) {
    return fromAncestor;
  }

  const customDefault = context.frontmatter?.anki_customCardDefault;
  if (context.hasFieldBlocks && customDefault) {
    return {
      kind: "custom",
      noteTypeId: customDefault,
      resolvedFrom: `anki_customCardDefault: ${customDefault}`,
    };
  }

  // RES-05 — delimiter sets type only when still unresolved after steps 1–3.
  if (context.hasReversibleDelimiter) {
    return {
      kind: "builtin",
      type: "reversible",
      resolvedFrom: "delimiter :::r",
    };
  }

  if (context.hasTypedDelimiter) {
    return {
      kind: "builtin",
      type: "typed",
      resolvedFrom: "delimiter :::t",
    };
  }

  const cardDefault = context.frontmatter?.anki_cardDefault;
  if (cardDefault) {
    const basicResolved: ResolvedCardType = {
      kind: "builtin",
      type: cardDefault,
      resolvedFrom: `anki_cardDefault: ${cardDefault}`,
    };

    if (
      cardDefault === "basic" &&
      context.inferClozeFromManualSyntaxOnBasic &&
      hasManualClozeSyntax(context.textRegion)
    ) {
      return inferClozeFromText(context.textRegion, true);
    }

    return basicResolved;
  }

  if (hasManualClozeSyntax(context.textRegion)) {
    return inferClozeFromText(context.textRegion, false);
  }

  return {
    kind: "builtin",
    type: "basic",
    resolvedFrom: "default basic",
  };
}
