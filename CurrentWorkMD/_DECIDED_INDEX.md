# Decided decisions — index

**Canonical contract (read this):**  
[`Docs/DECIDING/DECIDED-Preview-Sync-Contract-2026-07.md`](../Docs/DECIDING/DECIDED-Preview-Sync-Contract-2026-07.md)

**Status:** DECIDED 2026-07 — Phase 0 complete. Implementation = Phases 1–2c (shared parser + all built-ins). Custom = Phase 3 (deferred).

## Decision worksheets (filled sources)

Do not re-litigate; use the contract. These remain the audit trail:

| File | Topic |
|------|--------|
| [`_DecisionsNeeded_01_PreviewSyncAlignment.md`](./_DecisionsNeeded_01_PreviewSyncAlignment.md) | Preview outcome ↔ sync |
| [`_DecisionsNeeded_02_CardTypesAnkiSync.md`](./_DecisionsNeeded_02_CardTypesAnkiSync.md) | Built-in / custom Anki mapping |
| [`_DecisionsNeeded_03_RuleBookAmbiguities.md`](./_DecisionsNeeded_03_RuleBookAmbiguities.md) | Spec ambiguities (CLZ-11, TYP-05, CX-25, G4, …) |
| [`_DecisionsNeeded_04_CSSCosmeticVsBehavioral.md`](./_DecisionsNeeded_04_CSSCosmeticVsBehavioral.md) | Cosmetic vs behavioral CSS |
| [`_DecisionsNeeded_05_PriorityAndPhasing.md`](./_DecisionsNeeded_05_PriorityAndPhasing.md) | Phasing, tests, success criteria |

## Phase snapshot

| Phase | Intent | Phase status |
|-------|--------|--------------|
| **0** | Decisions locked | **Done** |
| **1** | `parseCardDocument` sync path; skip/error hard-block; warn syncs | **Done** (see `_ImplementationStatus_Phase1.md`) |
| **2** | basic + cloze + reversible + typed (one pass) | **Done** (see `_ImplementationStatus_Phase2.md`) |
| **2b** | inferCloze both paths; auto-create stock models + opt-out; TYP-03b rename | **Done** (see `_ImplementationStatus_Phase2b.md`) |
| **2c** | TYP-05 multi-answer; model migration + type-mix summary | **Done** (see `_ImplementationStatus_Phase2c.md`) |
| **3** | Custom note types | Deferred |
| **4** | Polish (CX-25/G4 fixtures, stress expand, markers) | Later |

**Wave rollup:** [`_ImplementationStatus_COMPLETE_WAVE.md`](./_ImplementationStatus_COMPLETE_WAVE.md)

Confirmed non-blockers for code start: vault mix N/A; CX-25 typo + G4 fixture repair (docs/fixtures owners); subset-first tests → full built-in parity within v1.
