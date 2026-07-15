# Priority and Phasing

## How to use these files

1. Open each `_DecisionsNeeded_*.md` file in order (01 → 05).
2. For each question, tick **one** checkbox (or write under **Other**).
3. You can leave questions blank — mark them with `?` in Your notes if you want to discuss later.
4. **BLOCK** = implementation cannot proceed safely without your answer. **NICE-TO-HAVE** = polish or later phase.
5. Other files cross-reference instead of repeating the same question — follow links when you see them.

---

## Derived from your decisions (01–04)

Plain-language phase plan implied by your answers:

1. **Unify first:** Wire sync to the same `parseCardDocument` outcomes as preview (strict mirror). `skip`/`error` never sync; `warn` syncs with warnings surfaced.
2. **Built-in multi-type sync in one pass:** basic + cloze + reversible + typed together — not “block now, implement later.” No long dual-pipeline lag.
3. **Default Anki models:** Use stock names (`Basic`, `Cloze`, `Basic (and reversed card)`, typed default); auto-create built-ins (settings toggle to opt out); custom stays later with a clear “not implemented” warning when identified.
4. **Align settings that already pretend to match sync:** e.g. `inferClozeFromManualSyntaxOnBasic` must affect preview **and** sync.
5. **Later:** custom note types (partial-field policy deferred with them), remap UI, reading/source mode polish, CX-25 / G4 doc+fixture fixes (proposed in 03 — confirm).
6. **In scope with v1 (not “later”):** typed multi-answer (`Paris|Lyon`), model migration best-effort + summary counts, pre-sync mismatch summary, behavioral CSS outcomes/types/garnish.

---

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


| Candidate                               | Risk if delayed                   | Effort (rough) |
| --------------------------------------- | --------------------------------- | -------------- |
| Block sync on preview error/skip        | High — wrong notes in Anki        | Medium         |
| Wire `parseCardDocument` into sync path | High — single source of truth     | Medium–High    |
| Cloze model sync                        | High — literal `{{c1::}}` in Anki | High           |
| `:::r`/`:::t` stopgap (strip/block)     | Med — stray `r`/`t` in Back       | Low            |
| Fix `inferCloze` setting mismatch       | Med — misleading toggle           | Low–Med        |
| Custom note types                       | Med (if you use them)             | High           |
| Spec/doc fixes only (CX-25, G4 label)   | Low                               | Low            |


- [ ] **Option A — Safety first:** D2 from file 01 (block error/skip) + `:::r`/`:::t` stopgap before any new models.
- [ ] **Option B — Parser unity:** Single pipeline (`parseCardDocument` → sync) for basic only, then add types.
- [ ] **Option C — Cloze end-to-end:** Full parser unity + cloze Anki model in one milestone.
- [x] **Option D — Your order** (rank 1–5 in notes below)
- [x] **Other (write below):** One proper change: unify pipeline **and** ship all built-in Anki types together — do **not** do stopgap block/unblock for `:::r`/`:::t`. (Your 01 notes + conversation: foundation-first, then multi-type on the shared path.)

← from 01 notes (“implement typed sync… one proper change”) + 02 D1 (all built-ins) + conversation (unify before dual pipelines) + 04 D1/D2 (implement typed sync now).

**Your priority rank (1 = first):**

```
1. Wire parseCardDocument into sync (outcomes gate: skip/error hard-block; warn syncs) — 01 D1–D3
2. All built-in Anki models in one pass: basic + cloze + reversible + typed (no :::r/:::t Basic stopgap) — 02 D1, 01 D5 superseded by notes
3. Wire inferClozeFromManualSyntaxOnBasic to both preview and sync — 01 D4
4. Pre-sync summary + type-migration counts in results — 01 D6, 02 D6
5. Custom types later (identify + “not implemented” warning only) — 02 D4; CUS policy with that pass — 03 D6
```

---



## D2 — Can preview ship ahead of sync temporarily?

**BLOCK**

If multi-type sync takes multiple passes, is a period of intentional mismatch acceptable?

**Why it matters:** Affects whether we disable chips for unsupported types or show warnings.

- [x] **Option A — No:** Hide or downgrade preview for types sync can’t handle yet.
- [ ] **Option B — Yes with banner:** Preview on; global notice “Only Basic syncs to Anki today.”
- [ ] **Option C — Yes silently:** Current behavior until done (not recommended).
- [x] **Other (write below):** Prefer **no intentional mismatch**. Preview already shows typed/cloze correctly; sync catches up in the same implementation pass rather than a “preview only / Basic sync” transition. (If a type is truly not ready, chip must not claim sync — per strict mirror.)

← from 01 D1 (strict mirror) + 01 notes (implement typed sync now) + 04 D1/D2 (behavioral; we will implement sync) + conversation (UI signal = sync behavior).

---



## D3 — Test strategy for phase 1

**NICE-TO-HAVE**

Stress fixture: `tests/fixtures/new format/card-syntax-stress-test.md` (scenarios A1–O2).

- [ ] **Option A — Sync integration tests** must match preview expectations per scenario (big bang) **before any merge**.
- [ ] **Option B — Subset first forever:** Basic + error/skip blocking + one cloze; expand “someday” (no v1 deadline).
- [ ] **Option C — Preview tests only** until parser wired; sync tests after.
- [x] **CONFIRMED — Subset-first → full built-in parity within v1:** Start with a focused failing suite (shared `parseCardDocument` gate + basic + skip/error + one cloze), expand under TDD until preview↔sync parity covers **all built-ins** (basic, cloze, reversible, typed + TYP-05). Full A1–O2 stress-matrix parity is a stretch goal **inside** v1 / Phase 4 polish — **not** a gate before first merge.

**Why (derived):** You chose foundation-first then all built-ins in one v1 pass (D1), TDD, and **no intentional preview/sync mismatch** (D2). Waiting for every stress scenario before merge freezes progress; shipping types without sync tests would reintroduce mismatch. Subset-first with a hard “all built-ins covered before v1 done” hits both constraints.

← from 02 D1 (all built-ins in v1) + TDD / shared-engine principle + 05 D1/D2 (no dual-pipeline lag, no intentional mismatch).

---



## D4 — Settings / config surface for phase 1

**BLOCK**

What new settings are you willing to configure in the first pass?


| Setting                             | Exists today     | Needed for                    |
| ----------------------------------- | ---------------- | ----------------------------- |
| `noteModelName`                     | ✅ (Basic only)   | Single model                  |
| `anki_noteTypeMap`                  | ❌ (spec only)    | Per-type Anki names (file 02) |
| `inferClozeFromManualSyntaxOnBasic` | ✅ (preview only) | BAS-04 (file 01 D4)           |
| noteType field cache refresh        | ✅ (preview)      | Custom types                  |


- [ ] **Option A — Minimal:** Extend `noteModelName` → map object for built-ins only.
- [ ] **Option B — Full map UI:** All types + custom in settings tab.
- [ ] **Option C — config.json for CLI** first; plugin settings later.
- [x] **Other (write below):** **Least resistance:** hard-coded stock Anki model names for built-ins (02 D2 — remapping later). Phase 1 settings: (1) make `inferClozeFromManualSyntaxOnBasic` affect sync (01 D4); (2) toggle to opt out of auto-create built-in models (02 D5). No full `anki_noteTypeMap` UI yet. No custom noteType cache work for sync yet (02 D4).

← from 02 D2 (“default Anki card types should simply work… remapping later”) + 02 D5 (auto-create built-ins + opt-out toggle) + 01 D4 (inferCloze both paths).

---



## D5 — Deferred explicitly to later phases

**NICE-TO-HAVE**

Tick what is **out of scope** for first implementation pass (so we don’t slip scope).

- [ ] TYP-05 multi-answer (`Paris|Lyon`) — deferred v2 per spec
  <!-- NOT deferred: 03 D3 says implement now (with space-tolerant pipes). -->
- [x] CUS-07 layout remapping (basic `:::` → custom fields via settings)
- [x] Per-card YAML type blocks
- [x] Reading mode preview parity
- [x] Source mode decorations
- [ ] Model migration (file 02 D6) — handle later
  <!-- NOT deferred: 02 D6 = best-effort update in place + show N type-migrated in summary. -->
- [x] **Other (write below):**
  - Custom note type sync + CUS partial-field policy — later (02 D4, 03 D6); v1 may **identify** custom and **warn “not implemented.”**
  - `anki_noteTypeMap` remapping UI — later (02 D2).
  - Spec cleanup CX-25 / G4 fixture repair — proposed in 03 D4/D8 (confirm); apply in polish / when touching those docs/fixtures.
  - Sync marker “in Anki” presence checks — later only if optimized (04 D4).

← from 02 D4, 03 D3, 03 D6, 02 D2, 02 D6, 04 D4.

---



## D6 — Success criteria — “done enough” for v1

**BLOCK**

How will you know the first pass is successful?

- [ ] **Option A — Parity checklist:** Random 20 cards: preview outcome = sync result for all.
- [ ] **Option B — Type-specific:** All cloze cards in vault sync as Cloze with correct deletions.
- [ ] **Option C — No regressions:** Existing Basic vault still syncs; new types additive.
- [x] **Option D — Custom criteria** (write below)
- [x] **Other (write below):**
  - Preview outcome (sync/skip/warn/error) **and** resolved type match what Anki gets for basic, cloze, reversible, typed.
  - `skip`/`error` never create/update notes; `warn` syncs with warnings in results (01 D1–D3).
  - Custom identified cards warn-not-implemented rather than silent Basic (02 D4).
  - Existing Basic vault still syncs; new types additive (Option C included).
  - Pre-sync / summary surfaces type migrations and (during any short transition) mismatches (01 D6, 02 D6).

← from 01 D1–D3 + 02 D1 + 02 D4 + conversation principle.

**Your vault mix (rough %):** Basic ___% | Cloze ___% | Reversible ___% | Typed ___% | Custom ___%

- [x] **CONFIRMED — Skip / N/A:** Do **not** bias engineering order by vault composition. Prioritize by **product completeness** (all built-ins + shared pipeline) per D1. Fill percentages later only if you want analytics; they are not required to code.

**What this metric meant:** Optional planning hint — e.g. “80% Basic / 15% Cloze” would bias which type to harden first. You never provided vault stats, and D1 already locks “all built-ins in one pass,” so mix % adds no decision value now.

---



## D7 — Decision files deadline

**NICE-TO-HAVE**

Which decisions are **must-answer** before any code?


| File                                                                | Minimum decisions      |
| ------------------------------------------------------------------- | ---------------------- |
| [01 Preview ↔ Sync](./_DecisionsNeeded_01_PreviewSyncAlignment.md)  | D1, D2, D4, D5         |
| [02 Card types](./_DecisionsNeeded_02_CardTypesAnkiSync.md)         | D1, D2, D3             |
| [03 Rule ambiguities](./_DecisionsNeeded_03_RuleBookAmbiguities.md) | D1, D5, D6 (if custom) |
| [04 CSS](./_DecisionsNeeded_04_CSSCosmeticVsBehavioral.md)          | D1, D2, D7             |
| [05 Phasing](./_DecisionsNeeded_05_PriorityAndPhasing.md)           | D1, D2, D6             |


- [ ] **Option A — I’ll fill BLOCK items only** before you start coding
- [x] **Option B — I’ll fill all files in one sitting**
- [ ] **Option C — Pair-program:** Walk through BLOCK items together in chat
- [x] **Other (write below):** BLOCK items in 01–04 (and this file’s derived phasing) are filled. D3, vault mix N/A, and 03 CX-25/G4 are **CONFIRMED** (user accepted defaults). Not blockers for shared pipeline + built-in types.

← implied by you filling 01–04 and asking to derive 05.

---



## Suggested default phasing (if you want a starting proposal)

*Updated to match your 01–04 answers — replace the old “stopgap then cloze” default.*


| Phase  | Deliverable                                                                 | Depends on        |
| ------ | --------------------------------------------------------------------------- | ----------------- |
| **0**  | BLOCK decisions complete (done for 01–04; 05 derived; a few clarifications) | —                 |
| **1**  | Shared `parseCardDocument` sync path + hard-block skip/error; warn syncs   | 01 D1–D3          |
| **2**  | Built-in Anki models: basic + cloze + reversible + typed (one pass)         | 02 D1–D5, 03 D2/D3/D5 |
| **2b** | `inferCloze` affects sync; auto-create built-ins + opt-out toggle           | 01 D4, 02 D5      |
| **2c** | TYP-05 multi-answer; model migration best-effort + summary                  | 03 D3, 02 D6, 01 D6 |
| **3**  | Custom note types + partial-field policy                                    | 02 D4, 03 D6      |
| **4**  | Polish: lightweight markers, CX-25/G4 doc+fixture fixes (03 D4/D8 proposed), stress-test expansion  | 04, 03 D4/D8      |


---



## Your notes / questions for me

### Confirmed defaults (user: go ahead)

1. **D3 tests:** CONFIRMED — subset-first expanding to **all built-ins within v1**; full A1–O2 matrix not a pre-merge gate. (See D3 above.)
2. **Vault mix %** (D6): CONFIRMED — **Skip / N/A**; prioritize product completeness, not vault %.
3. **From 03:** CX-25 + G4 — CONFIRMED fixes in [03 D4 / D8](./_DecisionsNeeded_03_RuleBookAmbiguities.md); doc/fixture polish, not a phase-1 code blocker.

```
Derived fill of this file from 01–04 answers. Do not invent scope beyond those answers.
D3, vault mix N/A, and 03 CX-25/G4 defaults are CONFIRMED.
```
