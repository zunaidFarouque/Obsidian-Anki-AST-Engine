# Bugfix — Text-only cloze missing obsidian uuid

**Date:** 2026-07-15  
**Symptom:** `Sync failed: Card sync payload missing obsidian uuid` on Text-only cloze (no `:::`).

## Cause

`buildCard` only derived `injectionOffset` from back nodes or delimiter end. Front-only cloze has neither, so `buildInjectionPlan` omitted `wouldInjectId` and `syncEngine` aborted the file sync.

## Fix

In `src/parser/stateMachine.ts` `buildCard`:

1. Fall back to end-of-front offset when no back/delimiter offset and no `ankiId`.
2. Also accept `<!--anki-id-->` on front (Text-only cards that already have an id).

No soft-fail change in `syncEngine` — invent path now works for these cards.

## Tests

- `tests/parser/stateMachine.test.ts` — front-only offset, cloze+`:::`, front anki-id
- `tests/syncPipeline.multiType.phase2.test.ts` — live mocked add + vault inject at front end

## User action

Rebuild/redeploy the plugin, then re-sync the note. Do **not** add empty `:::` as a workaround. After sync, Text-only cloze cards should gain `<!--anki-id: …-->` at the end of Text.
