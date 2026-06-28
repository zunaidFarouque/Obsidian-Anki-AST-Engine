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
| `![[...]]` | Embed (transclusion) |

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
