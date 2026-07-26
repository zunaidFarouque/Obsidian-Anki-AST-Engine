# Implementation Status — Complete Wave (Phases 1–2c)

**Date:** 2026-07-15  
**Verdict:** Built-in preview↔sync contract wave is **complete**. Ready for human Obsidian + Anki smoke.  
**Canonical decisions:** [`_DECIDED_INDEX.md`](./_DECIDED_INDEX.md) · [`Docs/DECIDING/DECIDED-Preview-Sync-Contract-2026-07.md`](../Docs/DECIDING/DECIDED-Preview-Sync-Contract-2026-07.md)

## Done

| Track | What landed |
|-------|-------------|
| **Phase 1** | Shared `parseCardDocument` write gate; `skip`/`error` hard-block; `warn` may sync; `:::r`/`:::t` delimiter consume |
| **Phase 2** | Built-ins → stock Anki models (Basic / Cloze / reversible / typed); custom identify + warn/hard-skip (never silent Basic) |
| **Phase 2b** | `inferClozeFromManualSyntaxOnBasic` on preview **and** sync; `autoCreateStockNoteModels` + settings opt-out; TYP-03b rename |
| **Phase 2c** | TYP-05 multi-answer (`a\|b\|c`); best-effort model mismatch (fields update / block + summary); type-mix counts in CLI + results modal |
| **Rule IDs** | TYP-03b, CLZ-06, CLZ-11→error, REV-06, CUS-04 aligned to Spec |
| **Docs** | Anki-Integration / Engine-Architecture / Card-Rendering / Plugin-Roadmap / Spec status callouts reconciled (2b–2c no longer “in progress”) |

Per-phase detail: `_ImplementationStatus_Phase1.md` … `_Phase2c.md`, `_ImplementationStatus_RuleIdAlignment.md`, `_DocsReconciliation_Note.md`.

## Explicitly deferred

| Item | Notes |
|------|--------|
| **Phase 3 — custom note type field sync** | Identify + warn/hard-skip only; no Anki field payloads |
| **True Anki Change Note Type** | AnkiConnect cannot retype notes; 2c is warn/summary + compatible fields only |
| **Reading-mode card preview CSS** | Live Preview overlays only; no `registerMarkdownPostProcessor` yet |
| **CUS-07 / `anki_noteTypeMap` remapping UI** | Later |
| **Phase 4 polish** | CX-25/G4 already touched in Phase 1; broader stress-matrix / markers later |
| **Pre-sync confirmation gate UI** | Counts in results modal are enough for v1 (01 D6 Option B partial) |

Phase 3 custom sync was **not** half-implemented — `stockNoteModels` still returns not-implemented for custom; leave deferred.

## Verification (this consolidation)

- Focused: `tests/syncPipeline*`, `tests/anki/**`, `tests/cardSyntax/**`, `tests/parser/**` → **301 pass / 0 fail**
- Full `bun test` → **611 pass / 0 fail** (78 files) after live-mock fix
- Fix applied: `tests/syncPipeline.live.test.ts` mock now answers `modelNames` / `createModel` (Phase 2b default auto-create)

## Suggested next human actions (smoke)

Manual built-in stress note: [`Custom Card types and Others.md`](./Custom%20Card%20types%20and%20Others.md).

1. Build/deploy plugin; open vault with Anki Desktop + AnkiConnect running.
2. Sync a note with **basic**, **cloze**, **`:::r`**, **`:::t`** (incl. `Paris|Lyon` multi-answer) — confirm correct stock models + id inject.
3. Toggle **infer cloze on basic** and **auto-create stock models** off/on; confirm opt-out fails clearly when model missing.
4. Preview a **custom** `#anki/noteType/…` card — warn not-implemented, no silent Basic write.
5. Optionally force type mismatch (existing Basic note → cloze content) — expect block or fields-updated warning + summary counts.
