# Implementation Status — Phase 2c (TYP-05 + migration / type-mix)

**Date:** 2026-07-15  
**Goal:** TYP-05 multi-answer typed backs; best-effort model mismatch handling + summary / type-mix counts.  
**Prior:** `_ImplementationStatus_Phase2.md` (built-in stock models)  
**Decisions:** DECIDED contract §2.3 / §2.5; `_DecisionsNeeded_02` D6; `_DecisionsNeeded_03` D3; `_DecisionsNeeded_01` D6; `_DecisionsNeeded_05` Phase 2c

## Landed this phase

1. **TYP-05 multi-answer** — `extractTypedBackPlainText` / `parseTypedAcceptableAnswers` / `formatTypedAnswersForAnki` in `src/cardSyntax/layoutValidator.ts`
   - First non-empty line (TYP-04) → strip HTML/markdown (TYP-03) → split on `|`, trim segments, drop empties → join as `Paris|Lyon|Marseille` for Anki typed Back
   - Space-tolerant authoring: `Paris | Lyon` and `Paris|Lyon` both normalize
   - Formatting warn remains **TYP-03b** (already renamed; not TYP-05)
2. **Model migration (minimal viable)** — `assessModelMigration` + `updateExistingNoteWithMigration` in `src/anki/syncEngine.ts`
   - AnkiConnect **cannot** change note type; behavior is warn/summary, not silent forever
   - Same field keys on existing note (e.g. Basic ↔ typed Front/Back) → update fields in place + `typeMigration: fields_updated_model_unchanged` warning
   - Missing fields (e.g. Basic → Cloze Text) → **skip** write + `blocked_incompatible_fields` (no dumping Cloze into Basic)
3. **Summaries** — `summarizeSyncTypeMix` / extended `SyncSummary` (`typeMigrated`, `modelMismatchBlocked`, `typeMix`)
   - CLI log: type mix + migration counts
   - Plugin results modal: optional type-mix + migration lines (summary-only UI)
   - Dry-run parity also attaches migration warnings via `assessModelMigration`

## Tests

- `bun test tests/cardSyntax/layoutValidator.test.ts -t multi-answer` → **pass**
- `bun test tests/syncPipeline.phase2c.test.ts` → **pass** (TYP-05 sync + type mix)
- `bun test tests/anki/syncEngine.test.ts -t "Phase 2c"` → **pass** (compatible + blocked migration)
- Phase 2 multi-type suite unchanged / green (not weakened)

## Explicitly deferred

| Item | Until |
| ---- | ----- |
| True Anki **Change Note Type** (preserve history + switch model) | Needs AnkiConnect / add-on support — not available via stock AnkiConnect |
| Full pre-sync confirmation dialog UI | Summary / CLI / results modal is enough for v1 (01 D6 Option B partially: counts in results; no modal gate before run) |
| Custom note type field sync | **Phase 3** |
| `anki_noteTypeMap` remapping UI | Later |
| Stock Anki accepting any-of alternatives natively | Encoding is canonical `a\|b\|c` in Back; add-ons / templates may interpret — stock Anki diffs the whole string |

## Coordination

- Phase **2b** (`inferCloze`, auto-create stock models) lands separately — avoid heavy edits to shared auto-create paths when parallel.
