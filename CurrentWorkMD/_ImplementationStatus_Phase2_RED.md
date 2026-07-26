# Implementation Status — Phase 2 RED (multi-type Anki sync)

**Date:** 2026-07-15  
**Goal:** TDD RED suite that defines Phase 2 success. Tests must stay failing until stock-model sync is implemented. Do **not** weaken assertions to go green.

**Depends on:** Phase 1 (shared `parseCardDocument` write gate) — `_ImplementationStatus_Phase1.md`  
**Decisions:** `_DecisionsNeeded_02_CardTypesAnkiSync.md` (D1–D3, D5, D7), `_DecisionsNeeded_05_PriorityAndPhasing.md` Phase 2

## Stock model contract (hard-coded; remapping later)

| Internal id  | Anki model name                 | Fields                                      |
| ------------ | ------------------------------- | ------------------------------------------- |
| `basic`      | `Basic`                         | Front, Back                                 |
| `cloze`      | `Cloze`                         | Text, Back Extra                            |
| `reversible` | `Basic (and reversed card)`     | Front, Back                                 |
| `typed`      | `Basic (type in the answer)`    | Front, Back (plain text per TYP-03/04 / D7) |

## RED test file

`tests/syncPipeline.multiType.phase2.test.ts`

| Test | Intent | Observed (bun test, 2026-07-15) |
| ---- | ------ | ------------------------------- |
| cloze-resolved → Cloze + Text / Back Extra | No Basic dumping of `{{cN::}}` | **FAIL** — `modelName` `"Basic"` ≠ `"Cloze"` (fields still Front/Back) |
| reversible `:::r` → Basic (and reversed card) | Correct stock reverse model | **FAIL** — `modelName` `"Basic"` ≠ `"Basic (and reversed card)"` |
| reversible `#anki/cardType/reversible` → same | Tag path same as delimiter | **FAIL** — same as `:::r` |
| typed `:::t` → type-in + plain Back | `**Paris** with <sub>accent</sub>` → `Paris with accent` | **FAIL** — `modelName` `"Basic"` ≠ `"Basic (type in the answer)"` (plain-text Back not reached) |
| cardSyntax skip still blocks | Phase 1 regression guard | **PASS** |
| valid basic still Basic | No regression on existing vault | **PASS** |

Run: `bun test tests/syncPipeline.multiType.phase2.test.ts` → **6 pass / 0 fail** (GREEN as of Phase 2 implementation).

**Superseded by:** `_ImplementationStatus_Phase2.md`

## Phase 2 agent checklist (make green)

1. Map `ResolvedCard.resolvedType` from the Phase 1 `parseCardDocument` pass into Anki `modelName` + field map before `syncFileCards` / `addNotes`.
2. Cloze: compile Text (with `{{cN::}}`) + optional Back Extra — not Front/Back on Basic.
3. Reversible: stock `Basic (and reversed card)`; Front/Back from split (no stray `r`).
4. Typed: stock `Basic (type in the answer)`; Back = plain text (strip HTML/markdown; first non-empty line).
5. Leave custom note types as identify + “not implemented” warn (Phase 3) — out of this RED suite.
6. Auto-create built-ins / opt-out toggle and `inferCloze` sync wiring are **Phase 2b** — not required to green these tests if stock models already exist in the mock (`modelNames`).

## Explicitly not in these RED tests

- Model auto-create + settings toggle (2b)
- `inferClozeFromManualSyntaxOnBasic` sync effect (2b)
- TYP-05 multi-answer / type-migration summary (2c)
- Custom note types (Phase 3)
