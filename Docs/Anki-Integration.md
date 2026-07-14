# Anki Integration

Live sync from the headless engine to Anki Desktop via [AnkiConnect](https://foosoft.net/projects/ankiconnect/) (add-on code **2055492159**).

## Prerequisites

1. **Anki Desktop** running locally.
2. **AnkiConnect** installed and enabled.
3. **`config.json`** with `vaultPath`, `scanFolders`, `defaultAnkiDeck`, and `ankiConnectUrl` (default `http://127.0.0.1:8765`).
4. Sync-eligible notes with `AnkiSync: on` frontmatter (see [Engine-Architecture.md](Engine-Architecture.md)).

### AnkiConnect configuration (CLI)

For this **Bun/Node CLI**, your AnkiConnect settings are fine as-is:

- `webBindAddress: 127.0.0.1`
- `webBindPort: 8765`
- `apiKey: null` (no auth header required)

CORS origins (`webCorsOriginList`) only matter for browser-based clients. They do not affect the CLI.

### AnkiConnect configuration (Obsidian plugin)

The Obsidian plugin uses Obsidian’s **`requestUrl` API** (not `fetch`), which bypasses browser CORS. Your `webCorsOriginList` is still good to keep, but connection failures are more often:

1. **Anki not running** (or AnkiConnect add-on disabled)
2. **Wrong URL** in plugin settings (default `http://127.0.0.1:8765`)
3. **API key mismatch** — if `apiKey` is set in AnkiConnect, match it in plugin settings

Recommended AnkiConnect config when using other tools that still use `fetch`:

```json
{
  "apiKey": null,
  "webBindAddress": "127.0.0.1",
  "webBindPort": 8765,
  "webCorsOriginList": [
    "http://localhost",
    "http://127.0.0.1",
    "app://obsidian.md"
  ]
}
```

Restart Anki after changing config. Quick check: open `http://127.0.0.1:8765` in a browser — you should see “AnkiConnect v.6” (or similar).

If you enable `apiKey` in AnkiConnect, set matching `ankiConnectApiKey` in plugin settings (or `config.json` for CLI).

### Note type

This release uses Anki’s built-in **Basic** model (`Front` + `Back`). No custom note type is required.

Optional styling for compiled HTML:

- **Math** — MathJax (default on Anki 2.1.20+ desktop).
- **Callouts** — add CSS for `.callout`, `.callout-tip`, etc. in Basic card styling.
- **Tables** — compiled tables use `class="anki-md-table"`. Paste [`templates/anki-basic-table.css`](../templates/anki-basic-table.css) into Basic card styling (or add your own rules for `.anki-md-table`).
- **Highlights** — `<mark>` renders with default browser/Anki styling.

### Decks

Default deck is `defaultAnkiDeck` in config (`Synced from Obsidian`). Per-file override via frontmatter `target_anki_deck`. When `autoCreateDecks` is `true` (default), missing decks are created via `createDeck`.

### Tags

Every synced note receives tags in this order:

1. **`defaultEngineTag`** from config (`Obsidian-Anki-AST`)
2. **`file_anki_tags`** from file frontmatter (comma-separated, optional)
3. **Heading path** — parent headers joined with `::` (when `includeParentHeadersAsTags` is enabled)
4. **`obsidian-id::<uuid>`** — binding tag (prefix from `syncTagPrefix`)

**Normalization:** Anki treats spaces as tag separators. The engine normalizes each `::` segment by replacing spaces with underscores:

```
Feature Stress Test::Subsection B  →  Feature_Stress_Test::Subsection_B
```

This ensures hierarchical tags stay intact in Anki Browser.

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

Each stdout line is a JSON `SyncAction`. Summary counts and **duplicate warnings** are printed to stderr.

### Stderr output

| Stream | Content |
|--------|---------|
| stdout | One JSON `SyncAction` per card |
| stderr | `duplicate_warning` events (see below), then sync summary |

Example summary:

```text
Sync complete (live): 37 card(s) — added 0, updated 4, skipped 33, failed 0, duplicate warning(s) 2
```

## ID binding (two-way)

| Location | Role |
|----------|------|
| Markdown `<!--anki-id: uuid-->` | Source of truth in the vault; parsed at card back |
| Anki tag `obsidian-id::<uuid>` | Lookup key in Anki (configurable via `syncTagPrefix`) |
| Engine tag e.g. `Obsidian-Anki-AST` | Universal tag on every synced note |
| Heading tag e.g. `CS101::Week_2::Entropy` | Organizational tag; normalized and updated each sync |

### New card flow

1. Engine compiles HTML.
2. Live sync adds the card via batched `addNotes` (or per-card `addNote` on batch failure) with `obsidian-id::<uuid>` tag.
3. On success, splices `<!--anki-id: uuid-->` into the markdown file at the AST-derived back offset.

### Update flow

1. Read `<!--anki-id: uuid-->` from card back.
2. Live sync prefetches all obsidian-id lookups for the file in one `multi` request; re-sync uses `findNotes` with `tag:"obsidian-id::<uuid>"` when resolving a single card via `syncCard`.
3. Compare `Front` / `Back` fields (with code-block line-ending normalization — see below); call `updateNoteFields` only when content truly changed.
4. `updateNoteTags` when tag set differs (engine, file, heading, or binding tags).

### Field comparison and code blocks

Compiled HTML is compared byte-for-byte against Anki’s stored fields. On Windows, fenced code blocks in source `.md` files often compile to **CRLF** (`\r\n`) inside `<pre><code>…</code></pre>`, while Anki typically stores **LF** (`\n`). Without normalization, every sync would report an `update` even though the card content is unchanged.

Before compare and before `addNote` / `addNotes` / `updateNoteFields`, the engine normalizes `\r\n` and lone `\r` to `\n` **inside `<pre><code>` blocks only**. Other HTML (paragraphs, `<br>`, tables) is left as compiled.

Implementation: [`src/anki/htmlNormalize.ts`](../src/anki/htmlNormalize.ts)

**Note:** stdout `SyncAction` lines still show the raw compiled `frontHtml` / `backHtml` from the vault pipeline. What Anki receives and what drives skip/update decisions is the normalized form.

### Orphan UUID

If markdown has a valid `anki-id` but Anki has no matching tag, the engine **re-adds** the note with the same UUID tag (no new markdown comment).

### Vault orphans

The opposite case: Anki has an engine-managed note with `obsidian-id::<uuid>` (and the default engine tag), but **no vault card** in the current full-vault scan carries that UUID. These are **vault orphans** — the vault card was removed or the UUID no longer appears in sync-eligible files.

On a **full-vault** sync (not single-file), the engine can detect orphans via `findNotes` + `notesInfo` + `cardsInfo` ([`orphanDetect.ts`](../src/anki/orphanDetect.ts)). Notes already tagged with the configured ignore tag (default `obsidian-sync-ignore`) are skipped. The Obsidian plugin prompts each live sync (**Ask each sync** setting) with **Cancel** (remind later), **Ignore** (add ignore tag; card stays active in Anki), or **Delete** before Anki is modified ([`orphanHandler.ts`](../src/anki/orphanHandler.ts)). **Suspend** is optional in plugin settings (off by default). Dry-run reports orphans in the results modal without changing Anki. Set **Orphan handling** to **Off** in plugin settings to skip detection.

Search ignored orphans in Anki: `tag:obsidian-sync-ignore`.

Do not confuse vault orphans with **Orphan UUID** above (vault has id, Anki missing → re-add).

### Duplicate recovery

If `addNote` / `addNotes` rejects a card because Anki already has a note with the same **Front** field in the target deck, the engine:

1. Finds candidate notes with a **targeted** Anki search: `deck:"…" front:"…"` (plain text stripped from compiled HTML), then confirms an exact `Front` field match — not a full-deck scan. See [`frontSearch.ts`](../src/anki/frontSearch.ts).
2. Reuses its `obsidian-id::<uuid>` tag if present; otherwise adds the planned binding tag.
3. Updates fields/tags if needed.
4. Splices `<!--anki-id: uuid-->` into the markdown when the vault file lacks one.

Lookups are cached per sync run (`SyncRunContext.frontMatchCache`) so multiple recoveries for the same front do not repeat API calls.

This breaks the re-sync deadlock where duplicate rejection prevented ID injection on every run.

## Card sync performance

Live card sync is optimized to minimize AnkiConnect round trips. Full detail: [Sync-Performance-Roadmap.md](Sync-Performance-Roadmap.md).

### Per-file batched path

For each file (after media upload):

1. **`invokeMulti`** — all `findNotes` queries for `obsidian-id::<uuid>` tags in one HTTP request.
2. **`notesInfo`** — one request for every existing note ID found.
3. **Parallel updates** — up to 10 cards (`pLimit(10)`) call `updateNoteFields` / `updateNoteTags` when content or tags changed.
4. **`addNotes`** — new cards added in chunks of up to **50** per HTTP request.
5. **Fallbacks** — failed `addNotes` batch → per-card `addNote`; `null` slot in batch result → duplicate recovery (above).

### HTTP transport layer

All AnkiConnect actions share one client ([`client.ts`](../src/anki/client.ts)):

| Constant | Value | Purpose |
|----------|-------|---------|
| `DEFAULT_INVOKE_CONCURRENCY` | 5 | Max simultaneous HTTP requests (media + cards) |
| `DEFAULT_SYNC_CONCURRENCY` | 10 | Max parallel card **updates** per file |
| `DEFAULT_ADD_NOTES_CHUNK` | 50 | Max notes per `addNotes` request |

Transient errors (e.g. `Unable to connect. Is the computer able to access the url?` when Anki is overloaded) are retried automatically (3 attempts, exponential backoff).

### Deck cache

[`deckEnsurer.ts`](../src/anki/deckEnsurer.ts) loads `deckNames()` once per live sync run and deduplicates concurrent `createDeck` calls for the same new deck.

Dry-run does not contact Anki; performance optimizations apply only to live sync.

## Duplicate detection

Spaced repetition assumes **one Front → one Back → one Anki note**. Duplicates are not silently “fixed” by changing fixture content or merging unlike cards — they are **detected and logged** so authors can resolve the source.

After each sync (dry-run or live), the engine emits structured warnings on **stderr**:

```json
{"event":"duplicate_warning","kind":"back_mismatch","deck":"Synced from Obsidian","frontHtml":"<p>…</p>","message":"…","sources":[{"file":"…","tag":"…","ankiId":"…","backHtml":"…"}]}
```

### Warning kinds

| Kind | Meaning | Action for author |
|------|---------|-------------------|
| `vault_front_collision` | Two or more vault cards in the **same deck** compile to identical `frontHtml` (same back too) | They map to one Anki note. Remove or differentiate one card, or accept shared binding. |
| `back_mismatch` | Same `frontHtml` in the same deck but **different `backHtml`** | **SRS-breaking** — sync will keep overwriting the answer. Change the question text, heading, or back content so fronts differ, or delete the duplicate. |
| `anki_duplicate_recovered` | `addNote` / `addNotes` rejected as duplicate; engine linked to existing note by targeted Front match | Review whether the link is intended; ensure `<!--anki-id-->` was injected. |

### Common causes

- **Heading-as-front collision** — two cards with the same `####` title and empty prose before `:::` compile to the same front (`<p>Title</p>`).
- **Copy-pasted question** — same multi-line front in two notes (accidental or intentional).
- **Anki duplicate rule** — Anki already had a note with that Front in the deck before the vault card received an `anki-id`.

Duplicate-pair fixtures in `tests/fixtures/` (e.g. `card-rich-formatting.md` vs `card-feature-stress-test.md`) exist to regression-test this behavior — they are not a pattern to follow in a real vault.

Implementation: [`src/anki/duplicateDetect.ts`](../src/anki/duplicateDetect.ts)

## Per-file transaction

For each file:

1. Upload media (`storeMediaFile`, concurrency 3) using tiered transport:
   - **Vault files** — AnkiConnect `path` (local file copy; fastest)
   - **Path failure** — automatic fallback to `data` (base64)
   - **External markdown images** `![](https://...)` — AnkiConnect `url` (Anki downloads into `collection.media`)
   
   Dry-run JSON includes `mediaUploadDetails` with `{ fileName, transport }` per file. If media upload fails, no cards in that file are synced or injected.
2. Sync each card to Anki with **concurrency 10** on updates; new cards in a file are added via batched **`addNotes`** (chunks of 50). Existing note IDs are prefetched with one **`multi`** `findNotes` call per file. Per-card errors do not abort siblings. Deck existence is checked once per sync run ([`deckEnsurer.ts`](../src/anki/deckEnsurer.ts)). See [Sync-Performance-Roadmap.md](Sync-Performance-Roadmap.md).
3. Batch-inject new IDs for **all successful cards** (reverse offset order).

If one card fails for a non-recoverable reason, other successful cards in the same file still receive `<!--anki-id-->` comments.

## Config reference

| Field | Default | Purpose |
|-------|---------|---------|
| `scanFolders` | (required) | Vault subfolders to glob for `.md` files |
| `defaultAnkiDeck` | `Synced from Obsidian` | Target deck for all cards |
| `defaultEngineTag` | `Obsidian-Anki-AST` | Tag on every synced note |
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
| `cannot create note because it is a duplicate` | Re-run sync — engine links existing note and injects `<!--anki-id-->`. Check stderr for `anki_duplicate_recovered`. If it persists, check for multiple notes with identical Front in the same deck. |
| `Duplicate Anki notes for obsidian id` | Manual cleanup in Anki Browser (duplicate tags) |
| Cards show `update` every run but content unchanged | Often CRLF in code blocks (fixed by normalization) or duplicate-pair tag/back fights — check stderr `duplicate_warning` |
| `back_mismatch` duplicate warning | Two notes share the same compiled front but disagree on the answer — fix vault content, do not ignore |
| Images missing in Anki | Re-run sync; check `wouldUploadMedia` in dry-run |
| Math not rendering | Ensure Basic template supports MathJax |

## Implementation

- HTTP client: [`src/anki/client.ts`](../src/anki/client.ts)
- Sync logic: [`src/anki/syncEngine.ts`](../src/anki/syncEngine.ts)
- AnkiConnect client: [`src/anki/client.ts`](../src/anki/client.ts)
- Deck cache: [`src/anki/deckEnsurer.ts`](../src/anki/deckEnsurer.ts)
- Duplicate front search: [`src/anki/frontSearch.ts`](../src/anki/frontSearch.ts)
- Performance roadmap: [Sync-Performance-Roadmap.md](Sync-Performance-Roadmap.md)
- Duplicate detection: [`src/anki/duplicateDetect.ts`](../src/anki/duplicateDetect.ts)
- HTML field normalization: [`src/anki/htmlNormalize.ts`](../src/anki/htmlNormalize.ts)
- Media upload: [`src/anki/mediaQueue.ts`](../src/anki/mediaQueue.ts)
- Tag normalization: [`src/anki/tagNormalize.ts`](../src/anki/tagNormalize.ts)
- Pipeline: [`src/syncPipeline.ts`](../src/syncPipeline.ts)
- ID injection: [`src/io/surgicalInjector.ts`](../src/io/surgicalInjector.ts)

## Deferred

- Reversible / Cloze card types
- Custom note types with configurable field maps
- Exact in-note scroll to card byte offset (plugin uses heading anchors today)
- Full plugin orchestrator tests with mocked Obsidian `requestUrl`
