# Implementation status — Rule ID alignment (2026-07-15)

Aligned `cardSyntax` runtime `ruleId` emissions with [Card-Syntax-Spec.md](../Docs/DECIDING/Card-Syntax-Spec.md) locked severities/IDs.

## IDs fixed

| Rule | Was | Now |
|------|-----|-----|
| Typed-back formatting warn | `TYP-05` | **`TYP-03b`** (`parseCardDocument`) |
| Cloze hint-mismatch warn | `CLZ-07` | **`CLZ-06`** (`parseCardDocument`) |
| Cloze deletions only in Back | outcome **skip** | outcome **`error`** (`layoutValidator` CLZ-11) |
| Reversible ↔ typed conflict | missing / sync | **`REV-06` error** (+ CX-31) |
| Custom + plain `:::` only | already **skip** | unchanged **`CUS-04` skip** (locked) |

## Tests

- Unit: `parseCardDocument`, `layoutValidator` (TDD red→green)
- Fixture: stress-test B6 → `error`; E3 → `TYP-03b`
- `bun test tests/cardSyntax` → **161 pass / 0 fail**

## Out of scope

- `TYP-05` multi-answer pipe split (separate Phase 2c work)
- Large `syncPipeline` / Anki sync changes
