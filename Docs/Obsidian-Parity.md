# Obsidian Parity Specification

This document defines how the headless engine mirrors Obsidian link, embed, and block resolution. For sync gates, card layout, delimiters, and tag rules, see [Engine-Architecture.md](Engine-Architecture.md).

Official references:

- [Internal links](https://help.obsidian.md/linking/internal-links)
- [MetadataCache / link resolution](https://docs.obsidian.md/Reference/TypeScript+API/MetadataCache)

## Product-specific vs Obsidian-native

| Behavior | Obsidian | This engine |
|----------|----------|-------------|
| Frontmatter sync gate | Not required | `AnkiSync: on` / `true` / `yes` required to sync; key absent or disabled values skip the file |
| Parent headers as tags | Not applicable | Config `includeParentHeadersAsTags` (default `true`); per-file YAML override |
| Card delimiter | Not applicable | Default `:::` (config or per-file `delimiter` frontmatter); engine-specific |
| Wikilinks / embeds | Native | Reimplemented via `src/obsidian/linkResolver.ts` |
| Block IDs | `^id` on paragraphs or separate line | Same rules in `src/ast/blockIdTagging.ts` |

## Engine extensions (not Obsidian-native)

These behaviors are documented in full in [Engine-Architecture.md](Engine-Architecture.md):

- **`AnkiSync` frontmatter** — opt-in per file; only `on` / `true` / `yes` enable sync
- **Card delimiter** — default `:::`; config and per-file `delimiter` override
- **Declaration-level cards** — `cardDeclarationHeadingLevel` (default H4) with optional parent-header tag paths via `includeParentHeadersAsTags`
- **Deck mapping** — vault subfolders mapped to Anki decks via `config.json`

## Link syntax

| Syntax | Meaning |
|--------|---------|
| `[[Note]]` | Link to note |
| `[[Note\|Alias]]` | Link with display alias |
| `[[Note#Heading]]` | Link to heading section |
| `[[Note#^block-id]]` | Link to block |
| `[[#^block-id]]` | Same-note block link |
| `![[...]]` | Embed — note transclusion or image media (see below) |

## Media vs note embeds

| `![[target]]` resolves to | Behavior |
|---------------------------|----------|
| Note (`.md`) | Transclusion — content grafted inline via [`transclusionGraft.ts`](../src/ast/transclusionGraft.ts) |
| Raster image (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) | `image` mdast node → `<img>`; uploaded to Anki |
| SVG (`.svg`) | `image` mdast node → `<img>`; uploaded to Anki |
| Audio (`.mp3`) | `[sound:basename.mp3]` paragraph; uploaded to Anki |
| Video (`.mp4`) | `[sound:basename.mp4]` paragraph; uploaded to Anki |
| PDF (`.pdf`) | Link paragraph; uploaded to Anki |
| Missing file | Literal `![[...]]` kept in HTML + listed in `unresolvedEmbeds` |

Note transclusion with subpaths (`![[Note#^block]]`, `![[Note#Heading]]`) is unchanged. Media paths with block/heading subpaths are not treated as attachable media.

Markdown images `![](path)` use the same media resolver and upload path as wiki image embeds for raster formats. Wiki `![[…]]` is required for SVG, PDF, audio, and video.

Basename-only wiki embeds (`![[photo.jpg]]`) are resolved vault-wide via [`resolveAttachmentPath`](../src/obsidian/vaultIndex.ts): same directory as the source note, paths under the note’s folder, configured `attachmentFolder` (default `attachments`), then shortest unique path when `linkFormat` is `shortest`. Ambiguous matches stay unresolved.

Anki upload names may gain a content-hash suffix (`photo_=_a3f9b2c1.jpg`) when multiple vault files share the same basename in one sync — see [`mediaNaming.ts`](../src/anki/mediaNaming.ts).

Test fixtures: [`complex-media-paths.md`](../tests/fixtures/complex-media-paths.md) (raster images), [`complex-media-non-image.md`](../tests/fixtures/complex-media-non-image.md) (SVG, PDF, MP3, MP4). Run `bun run setup:fixtures` to download real sample files.

## File resolution (`getFirstLinkpathDest`)

1. Empty path or path starting with `#` → source file (same-note).
2. Paths starting with `./` or `../` → resolved relative to source file directory.
3. Otherwise search vault index by basename (with optional `.md` extension).
4. Ambiguous basename (multiple matches) → `null` unless one match is in source directory.

## Subpath resolution (`resolveSubpath`)

| Subpath | Behavior |
|---------|----------|
| `#^block-id` | Extract block via block index |
| `#Heading` | Extract section from heading until equal/higher depth heading |

## Block ID placement

- **Paragraphs:** `text ^block-id` at end of line (space before caret).
- **Lists / blockquotes:** `^block-id` on its own line after the block.

## Fixture matrix

See `tests/fixtures/obsidian-parity/` — each file includes `<!-- obsidian-expected: ... -->` comments for test assertions.
