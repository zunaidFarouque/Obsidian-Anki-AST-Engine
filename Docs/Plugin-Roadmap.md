# Obsidian Plugin Roadmap

Living reference for post–Step 1 plugin work. Step 1 (vault adapter + live sync) is complete.

## Current state

**Done**

- `VaultAdapter` + `ObsidianVaultAdapter` wired to `runSync`
- Live vault sync from Obsidian (Anki updates + surgical `<!--anki-id-->` injection)
- AnkiConnect via Obsidian `requestUrl` (not browser `fetch`)
- Deploy script: `bun run deploy:plugin`
- Pre-sync duplicate-front modal with **Cancel** / **Sync anyway** (conflicts skipped on proceed)
- Re-link notices (30s) with **Open in vault** / **Open in Anki** links
- `openVaultCard` navigation helper (heading anchor from tag)
- Dry-run commands (vault + current note) and sync-current-note command
- `SyncOptions.files` for scoped sync; shared `syncOrchestrator` for vault vs single-file flows
- Unified sync results modal with clickable failures, duplicates, and media warnings
- Settings for `noteModelName` and `syncTagPrefix`
- Fixture id-free integrity test guarding parser regression fixtures

**Still thin**

- Full orchestrator integration tests with mocked `requestUrl` (engine vault tests cover sync path)
- Heading-only scroll (no exact card offset navigation)
- Phase 4 items: auto-sync, community release

---

## Recommended implementation order

### Phase 1 — Daily-use commands (highest value, low risk)

#### 1. Dry-run command

**Done.** Commands: **Dry-run sync vault to Anki**, **Dry-run sync current note to Anki** (`plugin/src/syncOrchestrator.ts`).

---

#### 2. Sync current file only

**Done.** Command: **Sync current note to Anki** — full-vault duplicate preflight, live sync scoped to active file via `SyncOptions.files`.

---

### Phase 2 — UX polish

#### 3. Sync results modal

**Done.** [`plugin/src/ui/syncResultsModal.ts`](../plugin/src/ui/syncResultsModal.ts) — summary, failures, duplicate/media warnings, skipped conflicts; wired from [`syncOrchestrator.ts`](../plugin/src/syncOrchestrator.ts). Re-link recovery still uses 30s notices.

---

#### 4. In-editor navigation for warnings

**Done (heading anchor).** Clickable rows in results and duplicate modals call [`openVaultCard`](../plugin/src/navigation/openVaultCard.ts) (last `::` tag segment as heading). Exact card offset scroll deferred.

---

### Phase 3 — Stability and hygiene

Do in parallel with Phase 1–2 or immediately after.

| Item | Status |
|------|--------|
| Fix fixture test drift | **Done** — restored id-free fixtures + `fixtureIdFreeIntegrity.test.ts` |
| Plugin tests | **Partial** — `syncDisplayUtils`, `scanFolders`, `configBuilder`; full `requestUrl` mock deferred |
| Settings parity | **Done** — `noteModelName`, `syncTagPrefix` in plugin settings |
| Update docs | **Done** — this roadmap + `Anki-Integration.md` deferred section |

---

### Phase 4 — Later (larger scope)

- **Auto-sync on save** (debounced) — needs conflict handling if user edits during sync
- **Progress UI** — **Done** — file-level sync progress via `onProgress` + Obsidian Notice
- **Orphan handling** — **Done** — full-vault detection + confirmation modal (suspend/delete); see `Anki-Integration.md` **Vault orphans**
- **Cloze / custom note types** — engine is `Basic` only today
- **Community plugin release** — README, screenshots, `versions.json`, GitHub releases

---

## Suggested week timeline

| When | Focus |
|------|--------|
| Day 1–2 | Dry-run command + sync current file |
| Day 3–4 | Results modal with warnings and failures |
| Day 5 | Fix fixture test drift + harden deploy/build |

**Single best next task:** Phase 4 — auto-sync on save or community plugin release.

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
