# Implementation Status — Phase 2 (multi-type Anki sync)

**Date:** 2026-07-15  
**Goal:** Built-in card types sync to stock Anki models (basic / cloze / reversible / typed).  
**Prior RED:** `_ImplementationStatus_Phase2_RED.md`  
**Decisions:** `_DecisionsNeeded_02_CardTypesAnkiSync.md` (D1–D3, D7), DECIDED contract §2

## Landed this phase

1. **Stock model map** — `src/anki/stockNoteModels.ts`
   - `basic` → `Basic` (Front / Back)
   - `cloze` → `Cloze` (Text / Back Extra)
   - `reversible` → `Basic (and reversed card)` (Front / Back)
   - `typed` → `Basic (type in the answer)` (Front / plain-text Back via `extractTypedBackPlainText`)
2. **Pipeline wiring** — `syncPipeline` reads `ResolvedCard.resolvedType` from the Phase 1 `parseCardDocument` pass and builds `CardSyncPayload.modelName` + `fields` before `syncFileCards`.
3. **Engine** — `syncEngine` uses per-card `modelName` / `fields` (falls back to config `noteModelName` + Front/Back for callers that omit them). Field-change detection is model-agnostic.
4. **Custom** — Identify + hard-skip with “not yet implemented” message; never silent Basic.
5. **Config** — `noteModelType` enum expanded to `basic | cloze | reversible | typed` (sync still keys off resolved type, not this setting).

## Tests

- `bun test tests/syncPipeline.multiType.phase2.test.ts` → **6 pass / 0 fail**
- Regression: `syncPipeline.test.ts`, `syncEngine*.test.ts`, Phase 1 eligibility / delimiter suites, `configParser` — all pass

## Explicitly not in Phase 2 (next)

| Phase | Work |
| ----- | ---- |
| **2b** | `inferClozeFromManualSyntaxOnBasic` on both paths; auto-create built-ins + settings opt-out |
| **2c** | ✅ Done — see `_ImplementationStatus_Phase2c.md` (TYP-05; migration + type-mix summary) |
| **3** | Custom note type sync (payload + Anki fields) |
| **4** | Polish / remapping UI / stress-matrix expansion |
