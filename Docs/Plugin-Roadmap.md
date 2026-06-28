# Obsidian Plugin Roadmap

Living reference for post–Step 1 plugin work. Step 1 (vault adapter + live sync) is complete.

## Current state

**Done**

- `VaultAdapter` + `ObsidianVaultAdapter` wired to `runSync`
- Live vault sync from Obsidian (Anki updates + surgical `<!--anki-id-->` injection)
- AnkiConnect via Obsidian `requestUrl` (not browser `fetch`)
- Deploy script: `bun run deploy:plugin`
- Basic Notices for sync summary, duplicate warnings, and media warnings

**Still thin**

- Full-vault live sync only (no dry-run, no per-file sync)
- No rich results UI (Notices only)
- Some config hardcoded in `plugin/src/configBuilder.ts` (`noteModelName`, `syncTagPrefix`)
- Docs `Anki-Integration.md` deferred section partially outdated

---

## Recommended implementation order

### Phase 1 — Daily-use commands (highest value, low risk)

#### 1. Dry-run command

Add **“Dry-run sync to Anki”** calling:

```typescript
runSync(config, { dryRun: true, vault, ankiClient })
```

**Why first:** Same pipeline as live sync without Anki writes or ID injection. Matches CLI `bun run sync -- --dry-run`.

**Touches:** `plugin/src/main.ts`, optional command in ribbon palette.

---

#### 2. Sync current file only

Add **“Sync current note to Anki”** for the active `TFile`.

**Why:** Full-vault sync is slow on large vaults. This is the everyday workflow while editing.

**Implementation sketch:** Filter to one vault-relative path, or extend `SyncOptions` with e.g. `files?: string[]`.

**Touches:** `src/syncPipeline.ts` (optional `files` filter), `plugin/src/main.ts`.

---

### Phase 2 — UX polish

#### 3. Sync results modal

Replace stacked Notices with a modal or panel showing:

- Summary: added / updated / skipped / failed
- Failed cards with `syncError`
- `back_mismatch` and `vault_front_collision` with clickable file paths
- `media_warning` entries (including disambiguated basenames)

**Touches:** new `plugin/src/syncResultsModal.ts` (or similar), `plugin/src/main.ts`.

---

#### 4. In-editor navigation for warnings

For `back_mismatch` and failed syncs:

- Open the source note
- Optionally scroll to the card (tag or heading path)

Engine already returns `file`, `tag`, `frontHtml` on each `SyncAction`.

**Touches:** plugin UI layer; may use Obsidian `Workspace` / `MarkdownView` APIs.

---

### Phase 3 — Stability and hygiene

Do in parallel with Phase 1–2 or immediately after.

| Item | Why |
|------|-----|
| Fix 4 failing fixture tests | `injection-required-no-ids.md` has `anki-id` comments but tests expect cards without IDs — fixture/test drift |
| Plugin tests | Mock `requestUrl` / vault adapter for dry-run and live paths |
| Settings parity | Expose `syncTagPrefix`, `noteModelName` in settings (currently hardcoded in `configBuilder`) |
| Update docs | Refresh `Anki-Integration.md` deferred section; link here from `readme.md` |

---

### Phase 4 — Later (larger scope)

- **Auto-sync on save** (debounced) — needs conflict handling if user edits during sync
- **Progress UI** for large vaults (“Syncing 12/240 files…”)
- **Orphan handling** — suspend/delete Anki notes when cards removed from vault (see engine deferred list in `Anki-Integration.md`)
- **Cloze / custom note types** — engine is `Basic` only today
- **Community plugin release** — README, screenshots, `versions.json`, GitHub releases

---

## Suggested week timeline

| When | Focus |
|------|--------|
| Day 1–2 | Dry-run command + sync current file |
| Day 3–4 | Results modal with warnings and failures |
| Day 5 | Fix fixture test drift + harden deploy/build |

**Single best next task:** dry-run + sync current file — small scope, immediately useful, low risk after live sync is proven.

---

## Out of scope for early plugin phases

(From Step 1 plan; still deferred unless promoted above.)

- Rich sync results modal was deferred in Step 1 — now Phase 2
- Per-file sync was deferred — now Phase 1
- Auto-sync on save
- Community plugin store release
- Publishing engine to npm (esbuild `../dist` alias is fine for now)

---

## Related docs

- [Anki-Integration.md](Anki-Integration.md) — AnkiConnect setup, CLI vs plugin
- [Engine-Architecture.md](Engine-Architecture.md) — pipeline contract
- [plugin/README.md](../plugin/README.md) — build and deploy
