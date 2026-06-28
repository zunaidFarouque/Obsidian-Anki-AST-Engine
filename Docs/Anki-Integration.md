# Anki Integration

Live sync from the headless engine to Anki Desktop via [AnkiConnect](https://foosoft.net/projects/ankiconnect/) (add-on code **2055492159**).

## Prerequisites

1. **Anki Desktop** running locally.
2. **AnkiConnect** installed and enabled.
3. **`config.json`** with `vaultPath`, `deckMappings`, and `ankiConnectUrl` (default `http://127.0.0.1:8765`).
4. Sync-eligible notes with `AnkiSync: on` frontmatter (see [Engine-Architecture.md](Engine-Architecture.md)).

### AnkiConnect configuration (CLI)

For this **Bun/Node CLI**, your AnkiConnect settings are fine as-is:

- `webBindAddress: 127.0.0.1`
- `webBindPort: 8765`
- `apiKey: null` (no auth header required)

CORS origins (`webCorsOriginList`) only matter for browser-based clients (e.g. a future Obsidian plugin). They do not affect the CLI.

If you enable `apiKey` in AnkiConnect, set matching `ankiConnectApiKey` in `config.json`.

### Note type

This release uses Anki’s built-in **Basic** model (`Front` + `Back`). No custom note type is required.

Optional styling for compiled HTML:

- **Math** — MathJax (default on Anki 2.1.20+ desktop).
- **Callouts** — add CSS for `.callout`, `.callout-tip`, etc. in Basic card styling.
- **Highlights** — `<mark>` renders with default browser/Anki styling.

### Decks

Decks are taken from `deckMappings`. When `autoCreateDecks` is `true` (default), missing decks are created via `createDeck`.

## Connection check

```bash
bun run sync -- --check
```

Or manually:

```bash
curl -X POST http://127.0.0.1:8765 -d '{"action":"version","version":6}'
```

## Usage

**Dry-run** (no Anki HTTP, no vault writes):

```bash
bun run sync -- --dry-run
```

**Live sync**:

```bash
bun run sync
```

Each stdout line is a JSON `SyncAction`. Summary counts are printed to stderr.

## ID binding (two-way)

| Location | Role |
|----------|------|
| Markdown `<!--anki-id: uuid-->` | Source of truth in the vault; parsed at card back |
| Anki tag `obsidian-id::<uuid>` | Lookup key in Anki (configurable via `syncTagPrefix`) |
| Heading tag e.g. `CS101::Week 2::Entropy` | Organizational tag; updated each sync |

### New card flow

1. Engine compiles HTML.
2. `addNote` to target deck with `obsidian-id::<uuid>` tag.
3. On success, splices `<!--anki-id: uuid-->` into the markdown file at the AST-derived back offset.

### Update flow

1. Read `<!--anki-id: uuid-->` from card back.
2. `findNotes` with `tag:"obsidian-id::<uuid>"`.
3. Compare `Front` / `Back` fields; call `updateNoteFields` only when changed.
4. `updateNoteTags` when heading tags differ.

### Orphan UUID

If markdown has a valid `anki-id` but Anki has no matching tag, the engine **re-adds** the note with the same UUID tag (no new markdown comment).

## Per-file transaction

For each file:

1. Upload media (`storeMediaFile`, concurrency 3).
2. Sync all cards to Anki.
3. **Only if every card succeeds:** batch-inject new IDs (reverse offset order).

If any Anki operation fails, the vault file is **not** modified for that file.

## Config reference

| Field | Default | Purpose |
|-------|---------|---------|
| `ankiConnectUrl` | `http://127.0.0.1:8765` | AnkiConnect endpoint |
| `ankiConnectApiKey` | omitted | Matches AnkiConnect `apiKey` when set |
| `noteModelName` | `Basic` | Note type for `addNote` |
| `noteModelType` | `basic` | Future: reversible / cloze / custom |
| `autoCreateDecks` | `true` | `createDeck` when deck missing |
| `syncTagPrefix` | `obsidian-id` | Prefix for UUID binding tags |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Cannot connect to AnkiConnect` | Open Anki Desktop; verify add-on enabled and port 8765 |
| `Anki deck not found` | Create deck or set `autoCreateDecks: true` |
| `Duplicate Anki notes for obsidian id` | Manual cleanup in Anki Browser (duplicate tags) |
| Images missing in Anki | Re-run sync; check `wouldUploadMedia` in dry-run |
| Math not rendering | Ensure Basic template supports MathJax |

## Implementation

- HTTP client: [`src/anki/client.ts`](../src/anki/client.ts)
- Sync logic: [`src/anki/syncEngine.ts`](../src/anki/syncEngine.ts)
- Media upload: [`src/anki/mediaQueue.ts`](../src/anki/mediaQueue.ts)
- Pipeline: [`src/syncPipeline.ts`](../src/syncPipeline.ts)
- ID injection: [`src/io/surgicalInjector.ts`](../src/io/surgicalInjector.ts)

## Deferred

- Reversible / Cloze card types
- Custom note types with configurable field maps
- Suspend/delete orphaned Anki notes when cards are removed from vault
- Obsidian plugin (browser CORS client)
