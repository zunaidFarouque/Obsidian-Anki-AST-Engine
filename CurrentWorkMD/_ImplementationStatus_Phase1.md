# Implementation Status — Phase 1 (Foundation)

**Date:** 2026-07-15  
**Decisions locked:** `_DecisionsNeeded_01`–`_05` (including CONFIRMED D3 / vault mix N/A / CX-25 / G4).

## Landed this phase

1. **Shared write gate** — `syncPipeline` consults `parseCardDocument` outcomes per card (matched by ordinal).
   - `skip` / `error` → `action: "skip"` with `skipReason: preview_skip | preview_error`; **no** add/update / id inject.
   - `warn` (effective) → still may sync; `previewWarnings` surfaced on `SyncAction`.
   - `sync` Basic → unchanged Front/Back write path.
2. **Eligibility helpers** — `src/cardSyntax/syncEligibility.ts` (`effectiveCardOutcome`, `isAnkiWriteAllowed`, `collectPreviewWarnings`). Plugin preview reuses the same effective-outcome logic.
3. **`:::r` / `:::t` no stray letter** — `findDelimiterMatch` consumes the `r`/`t` modifier so stateMachine Basic split no longer leaks `<p>r</p>` / `<p>t</p>` into Back.
4. **Doc/fixture polish (confirmed):** CX-25 matrix typo in `Card-Syntax-Spec.md`; G4 stress fixture retagged under `#biology #anki/cardType/cloze`.

## Tests

- `tests/cardSyntax/syncEligibility.test.ts`
- `tests/syncPipeline.test.ts` — skip / error / warn / basic / `:::r` / `:::t` acceptance cases
- `tests/parser/delimiterCheck.test.ts` — consumed length for `:::r` / `:::t`

## Explicitly not in Phase 1 (next)

| Phase | Work |
| ----- | ---- |
| **2** | Anki models for cloze / reversible / typed (stock names); still Basic write for non-basic `sync` outcomes today |
| **2b** | `inferClozeFromManualSyntaxOnBasic` affects sync; auto-create built-ins + opt-out |
| **2c** | TYP-05 multi-answer; model migration counts |
| **3** | Custom note types |
| **4** | Reading/source CSS polish; remapping UI; stress-matrix expansion |

## Hook for Phase 2

`SyncAction` already carries `previewOutcome` / warnings. Wire note-model selection off `ResolvedCard.resolvedType` from the same `parseCardDocument` pass before `syncFileCards` — do not re-derive type in the stateMachine path.
