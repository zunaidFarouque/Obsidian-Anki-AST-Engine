# Docs reconciliation note (2026-07)

**Purpose:** Pull locked decisions into product/architecture docs under `Docs/` so Future AI has one coherent story. Wave B code / `CurrentWorkMD` decision worksheets not touched.

**Sources of truth:** `Docs/DECIDING/DECIDED-Preview-Sync-Contract-2026-07.md`, `Card-Syntax-Spec.md`, `_ImplementationStatus_Phase1.md` / `_Phase2.md`, `_DECIDED_INDEX.md`.

## Files updated

| File | Change |
|------|--------|
| `Docs/Anki-Integration.md` | Status callout; stock multi-type models; preview hard-gate; config `noteModelType`; deferred→2b/2c/3 table; impl links |
| `Docs/Engine-Architecture.md` | Status + rule-source callout; pipeline steps for `parseCardDocument` / eligibility / stock models; `cardSyntax/` + `stockNoteModels.ts` in layout |
| `Docs/Card-Rendering.md` | Status callout (field mapping vs compile); SyncAction mentions outcomes / multi-field mapping |
| `Docs/Plugin-Roadmap.md` | Removed “Basic only”; custom = Phase 3; related-docs links |
| `Docs/DECIDING/Card-Syntax-Spec.md` | Status line only — Phase 2 landed; 2b–2c in progress (no rule-body rewrite) |
| `readme.md` | Feature bullet + Contributing links to DECIDED/Spec/Anki-Integration |

## Verified, not rewritten

- `Docs/DECIDING/DECIDED-Preview-Sync-Contract-2026-07.md`
- `Docs/DECIDING/Card-Preview-Design-Guidelines.md`
- `CurrentWorkMD/_DECIDED_INDEX.md`
- `CurrentWorkMD/_DecisionsNeeded_*.md` (intentionally untouched)

## Left alone (no conflicting deferred multi-type story)

- `Docs/Sync-Performance-Roadmap.md`, `Docs/Obsidian-Parity.md`, `Docs/Starter Arch DR.md`, `Docs/My notes.md`, `Docs/DECIDING/Syntax decision conversation.md`
