# Priority and Phasing

## Context

Audits found a **high-risk gap**: preview can show `cloze` / `reversible` / **sync** while Anki always receives **Basic** notes. Fixing that requires decisions in [01](./_DecisionsNeeded_01_PreviewSyncAlignment.md)–[04](./_DecisionsNeeded_04_CSSCosmeticVsBehavioral.md) and implementation phasing below.

**Today’s architecture (verified):**

```
Preview:  parseCardDocument → outcomes + types
Sync:     stateMachine.extractCards → compileCardFields → noteModelName "Basic"
```

---

## D1 — First milestone (smallest safe win)

**BLOCK**

What should the **first merged implementation** accomplish?

**Why it matters:** Prevents boiling the ocean; unblocks highest-risk mismatches first.

| Candidate | Risk if delayed | Effort (rough) |
|-----------|-----------------|----------------|
| Block sync on preview error/skip | High — wrong notes in Anki | Medium |
| Wire `parseCardDocument` into sync path | High — single source of truth | Medium–High |
| Cloze model sync | High — literal `{{c1::}}` in Anki | High |
| `:::r`/`:::t` stopgap (strip/block) | Med — stray `r`/`t` in Back | Low |
| Fix `inferCloze` setting mismatch | Med — misleading toggle | Low–Med |
| Custom note types | Med (if you use them) | High |
| Spec/doc fixes only (CX-25, G4 label) | Low | Low |

- [ ] **Option A — Safety first:** D2 from file 01 (block error/skip) + `:::r`/`:::t` stopgap before any new models.
- [ ] **Option B — Parser unity:** Single pipeline (`parseCardDocument` → sync) for basic only, then add types.
- [ ] **Option C — Cloze end-to-end:** Full parser unity + cloze Anki model in one milestone.
- [ ] **Option D — Your order** (rank 1–5 in notes below)
- [ ] **Other (write below):** ___

**Your priority rank (1 = first):**

```
1. 
2. 
3. 
4. 
5. 
```

---

## D2 — Can preview ship ahead of sync temporarily?

**BLOCK**

If multi-type sync takes multiple passes, is a period of intentional mismatch acceptable?

**Why it matters:** Affects whether we disable chips for unsupported types or show warnings.

- [ ] **Option A — No:** Hide or downgrade preview for types sync can’t handle yet.
- [ ] **Option B — Yes with banner:** Preview on; global notice “Only Basic syncs to Anki today.”
- [ ] **Option C — Yes silently:** Current behavior until done (not recommended).
- [ ] **Other (write below):** ___

---

## D3 — Test strategy for phase 1

**NICE-TO-HAVE**

Stress fixture: `tests/fixtures/new format/card-syntax-stress-test.md` (scenarios A1–O2).

- [ ] **Option A — Sync integration tests** must match preview expectations per scenario (big bang).
- [ ] **Option B — Subset first:** Basic + error/skip blocking + one cloze scenario; expand incrementally.
- [ ] **Option C — Preview tests only** until parser wired; sync tests after.
- [ ] **Other (write below):** ___

---

## D4 — Settings / config surface for phase 1

**BLOCK**

What new settings are you willing to configure in the first pass?

| Setting | Exists today | Needed for |
|---------|--------------|------------|
| `noteModelName` | ✅ (Basic only) | Single model |
| `anki_noteTypeMap` | ❌ (spec only) | Per-type Anki names (file 02) |
| `inferClozeFromManualSyntaxOnBasic` | ✅ (preview only) | BAS-04 (file 01 D4) |
| noteType field cache refresh | ✅ (preview) | Custom types |

- [ ] **Option A — Minimal:** Extend `noteModelName` → map object for built-ins only.
- [ ] **Option B — Full map UI:** All types + custom in settings tab.
- [ ] **Option C — config.json for CLI** first; plugin settings later.
- [ ] **Other (write below):** ___

---

## D5 — Deferred explicitly to later phases

**NICE-TO-HAVE**

Tick what is **out of scope** for first implementation pass (so we don’t slip scope).

- [ ] TYP-05 multi-answer (`Paris|Lyon`) — deferred v2 per spec
- [ ] CUS-07 layout remapping (basic `:::` → custom fields via settings)
- [ ] Per-card YAML type blocks
- [ ] Reading mode preview parity
- [ ] Source mode decorations
- [ ] Model migration (file 02 D6) — handle later
- [ ] **Other (write below):** ___

---

## D6 — Success criteria — “done enough” for v1

**BLOCK**

How will you know the first pass is successful?

- [ ] **Option A — Parity checklist:** Random 20 cards: preview outcome = sync result for all.
- [ ] **Option B — Type-specific:** All cloze cards in vault sync as Cloze with correct deletions.
- [ ] **Option C — No regressions:** Existing Basic vault still syncs; new types additive.
- [ ] **Option D — Custom criteria** (write below)
- [ ] **Other (write below):** ___

**Your vault mix (rough %):** Basic ___% | Cloze ___% | Reversible ___% | Typed ___% | Custom ___%

---

## D7 — Decision files deadline

**NICE-TO-HAVE**

Which decisions are **must-answer** before any code?

| File | Minimum decisions |
|------|-------------------|
| [01 Preview ↔ Sync](./_DecisionsNeeded_01_PreviewSyncAlignment.md) | D1, D2, D4, D5 |
| [02 Card types](./_DecisionsNeeded_02_CardTypesAnkiSync.md) | D1, D2, D3 |
| [03 Rule ambiguities](./_DecisionsNeeded_03_RuleBookAmbiguities.md) | D1, D5, D6 (if custom) |
| [04 CSS](./_DecisionsNeeded_04_CSSCosmeticVsBehavioral.md) | D1, D2, D7 |
| [05 Phasing](./_DecisionsNeeded_05_PriorityAndPhasing.md) | D1, D2, D6 |

- [ ] **Option A — I’ll fill BLOCK items only** before you start coding
- [ ] **Option B — I’ll fill all files in one sitting**
- [ ] **Option C — Pair-program:** Walk through BLOCK items together in chat
- [ ] **Other (write below):** ___

---

## Suggested default phasing (if you want a starting proposal)

*Not a decision — delete or edit in notes if you disagree.*

| Phase | Deliverable | Depends on |
|-------|-------------|------------|
| **0** | You complete BLOCK decisions in 01–05 | — |
| **1a** | `parseCardDocument` outcomes gate sync (skip/error don’t sync) | 01 D1–D2 |
| **1b** | `:::r`/`:::t` safe handling for Basic-era cards | 01 D5 |
| **2** | Cloze + reversible + typed Anki models | 02 D1–D5, 03 |
| **3** | Custom note types + partial-field policy | 02 D4, 03 D6 |
| **4** | Polish: markers, spec typos, stress test sync parity | 04, 03 D4/D8 |

---

## Your notes / questions for me

```
(your notes here)
```
