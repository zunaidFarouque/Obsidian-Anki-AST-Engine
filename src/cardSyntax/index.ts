/**
 * Card syntax v1 public API.
 * @see Docs/DECIDING/Card-Syntax-Spec.md
 */

export * from "./types";

export {
  parseHeadingHashtags,
  type HashtagParseResult,
  type HashtagParseError,
  type HashtagRuleId,
} from "./hashtagParser";

export {
  buildOutlineFromAst,
  buildOutline,
  getAncestorHeadings,
  findNearestTypeDeclaration,
  collectHeadingsFromAst,
  type OutlineHeading,
  type OutlineTree,
  type HeadingInput,
  type TypeDeclaration,
} from "./outlineTree";

export {
  resolveFileDefaults,
  resolveFileDefaultsFromRaw,
  parseBuiltInCardDefault,
  parseCustomCardDefault,
  parseAnkiCardDefaultFromFrontmatter,
  parseAnkiCustomCardDefaultFromFrontmatter,
  effectiveBuiltInDefaultFm04,
  effectiveCustomModelFm04,
  customDefaultAppliesRes04,
  type FileDefaults as FrontmatterFileDefaults,
} from "./frontmatterDefaults";

export {
  resolveCardType,
  type TypeResolverContext,
  type HeadingTypeDeclaration,
  type ResolvedCardType as ResolverResolvedCardType,
} from "./typeResolver";

export {
  processClozeDeletions,
  type ClozeProcessOptions,
  type ClozeProcessResult,
} from "./clozeProcessor";

export {
  extractCardRegions,
  type ExtractedCardRegions,
  type MdastFieldRegion,
} from "./regionExtractor";

export {
  validateCardLayout,
  extractTypedBackPlainText,
  type CardFieldBlock,
  type CardLayoutRegions,
  type LayoutValidatorOptions,
  type LayoutOutcome,
  type LayoutMessage,
  type LayoutValidationResult,
  type ResolvedCardType as LayoutResolvedCardType,
} from "./layoutValidator";

export { crossCuttingMessages, deriveCrossCuttingRuleIds } from "./crossCuttingRules";

export { parseCardDocument } from "./parseCardDocument";
export { getBodyStartOffset } from "../io/frontmatterFilter";
export {
  loadCardSyntaxStressTest,
  stressTestFixturePath,
} from "./loadFixture";
