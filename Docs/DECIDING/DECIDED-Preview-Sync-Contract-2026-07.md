# DECIDED — Preview ↔ Sync Contract (2026-07)

**Status:** DECIDED 2026-07  
**Audience:** Future AI agents and humans implementing preview/sync parity  
**Do not re-litigate.** Answers below are product locks. Spec rule text edits are owned separately; this file is the **behavioral contract** for implementation.

| | |
|---|---|
| **Sources (filled):** | [01](../../CurrentWorkMD/_DecisionsNeeded_01_PreviewSyncAlignment.md) · [02](../../CurrentWorkMD/_DecisionsNeeded_02_CardTypesAnkiSync.md) · [03](../../CurrentWorkMD/_DecisionsNeeded_03_RuleBookAmbiguities.md) · [04](../../CurrentWorkMD/_DecisionsNeeded_04_CSSCosmeticVsBehavioral.md) · [05](../../CurrentWorkMD/_DecisionsNeeded_05_PriorityAndPhasing.md) |
| **Related specs:** | [Card-Syntax-Spec.md](./Card-Syntax-Spec.md) · [Card-Preview-Design-Guidelines.md](./Card-Preview-Design-Guidelines.md) |
| **Index:** | [CurrentWorkMD/_DECIDED_INDEX.md](../../CurrentWorkMD/_DECIDED_INDEX.md) |

---

## 0 — North star (locked)

> **If the UI means something to the user, logic must match.**

Preview outcome chips and resolved types are **authoritative**. Sync must honor the same `parseCardDocument` engine. **No intentional preview/sync mismatch window.** Prefer one proper shared-pipeline + built-in multi-type change over stopgap block/unblock cycles.

---

## 1 — Preview outcome ↔ sync behavior

| Preview outcome | Sync must |
|-----------------|-----------|
| **sync** | Create/update using the **resolved** built-in type (basic / cloze / reversible / typed). |
| **warn** | **Proceed** to sync; surface warnings in sync results. |
| **skip** | **Hard block** — no add/update for that card. |
| **error** | **Hard block** — no add/update for that card. |

**Strict mirror (01 D1–D3):** Outcome chip is authoritative. Do not sync as Basic while preview shows cloze/reversible/typed/error.

**Settings alignment (01 D4):** `inferClozeFromManualSyntaxOnBasic` affects **both** preview and sync. When `true`, basic-resolved cards with `{{cN::…}}` in Text reclassify as cloze and sync as Cloze.

**`:::r` / `:::t` (01 D5 + 01 notes / 05 D1):** Do **not** ship a Basic-only stopgap (strip suffix / block-then-unblock). Implement reversible + typed sync in the same pass as other built-ins so garnish and Anki type match.

**Pre-sync UI (01 D6):** Pre-sync summary dialog counting mismatched / type-migrated cards before run (plus migration counts in results — see §2).

---

## 2 — Card types and Anki mapping (v1)

### 2.1 Scope

| Type | v1 sync | Notes |
|------|---------|--------|
| basic | ✅ | Stock model |
| cloze | ✅ | Stock model |
| reversible | ✅ | Stock model |
| typed | ✅ | Stock model; TYP-05 multi-answer in v1 |
| custom (`#anki/noteType/…`) | ❌ later | May **identify**; must **warn “not implemented”** — never silent Basic |

**v1 = all built-ins in one pass** (02 D1). Custom = Phase 3 / later (02 D4).

### 2.2 Stock Anki model names (02 D2)

Hard-coded least-resistance defaults. Remapping UI (`anki_noteTypeMap`) is **deferred**.

| Internal id | Anki model name |
|-------------|-----------------|
| `basic` | `Basic` |
| `cloze` | `Cloze` |
| `reversible` | `Basic (and reversed card)` |
| `typed` | `Basic (type in the answer)` |

Users are expected to have (or allow auto-create of) stock defaults.

### 2.3 Field mapping (02 D3)

| Type | Text region → | Back region → |
|------|---------------|---------------|
| basic | Front | Back |
| reversible | Front | Back (Anki generates reverse card) |
| typed | Front | Back — plain text (TYP-03/04) |
| cloze | Text | Back Extra (optional; CLZ-02) |

**Typed HTML strip (02 D7):** Strip all HTML; first-line plain text. Example: `**Paris** with <sub>accent</sub>` → `Paris with accent`.

**TYP-05 multi-answer (03 D3) — in v1, not deferred:** Pipe-separated synonyms; trim spaces around `|`.  
`Paris | Lyon | Marseille` → three acceptable answers: `Paris`, `Lyon`, `Marseille`. Same for unspaced `Paris|Lyon|Marseille`.

### 2.4 Missing models (02 D5)

- **Built-ins:** Auto-create stock templates where possible; **settings toggle to opt out**.
- **Custom:** Fail with clear error when/if attempted; not in v1 sync path beyond identify + warn.

### 2.5 Existing note, wrong model (02 D6)

- Best-effort **update in place** via AnkiConnect when model change is possible.
- Sync summary must report **N type-migrated** items.

---

## 3 — Rule-book locks (ambiguities resolved)

These override ambiguous / conflicting wording when wiring sync to `parseCardDocument`. Spec text polish may lag; **behavior below is canonical**.

| Topic | Locked behavior | Source |
|-------|-----------------|--------|
| BAS-06 / `:::r`·`:::t` on “basic” | Type resolution may promote to reversible/typed via delimiter; preview already does. Sync must follow resolved type — not Basic + stray `r`/`t`. | 03 D1 |
| CLZ-11 (deletions only after `:::`) | Explicit cloze tag + no valid Text deletions → **error** (stricter than old “skip”). | 03 D2 |
| TYP-05 | Multi-answer **implemented in v1** (see §2.3). Formatting warn stays separate concern. | 03 D3 |
| CX-25 matrix | **CONFIRMED typo fix:** CX-25 = non-empty Text deletion + optional `:::` → **sync** (CLZ-02). Empty `{{c1::}}` / `{{}}` → **skip** (CLZ-09 / CX-28). | 03 D4 |
| Reversible ↔ typed conflict | Any conflicting reversible vs typed signals → **error**. | 03 D5 |
| CUS partial required fields | **Decide later** with custom sync. | 03 D6 |
| CUS-04 plain `:::` on custom | **skip** (keep). | 03 D7 |
| G4 fixture (STR-04 / CX-29) | **CONFIRMED repair:** parent must carry `#biology` + `#anki/cardType/cloze`; fix expect comment. Fixture/docs polish — **not** a phase-1 sync code gate. Another agent owns fixtures. | 03 D8 |

---

## 4 — CSS: cosmetic vs behavioral (04)

| Signal / UI | Classification | Implication |
|-------------|----------------|-------------|
| Outcome tint + chip (sync/skip/warn/error) | **Behavioral** | Must match sync eligibility |
| Resolved type chip text | **Behavioral** | Must match Anki model path |
| Region boundaries (Text/Back/fields) | **Behavioral** | Shared engine with sync |
| Delimiter garnish (`:::r` ↕, `:::t` ⌨) | **Behavioral** | Must match synced type |
| Chip tooltip problem text | **Behavioral** | Same engine messages |
| Cloze group rainbow colors | **Cosmetic** | Anki has own cloze style |
| Layout spacing / inter-card gap | **Cosmetic** | Preview range = valid content (not trailing comments/HR) |
| `cardPreviewStyle` subtle vs explicit | **Cosmetic preference** | Outcomes identical |
| Sync marker emoji/icon | **Cosmetic “will sync”** | Parser says sync; **no** Anki presence index in v1 (CPU). Optional later if optimized |

**Boundary (04 D7):** Everything behavioral except spacing/colors (and lightweight will-sync marker). When typed/cloze sync ships, behavioral UI is already correct *if* it shares the parser.

---

## 5 — Phasing (foundation-first, then built-ins)

**No dual-pipeline lag. No “preview only / Basic sync” transition.**

| Phase | Deliverable | Status intent |
|-------|-------------|---------------|
| **0** | BLOCK decisions complete | Done (01–05 filled; defaults confirmed) |
| **1** | Shared `parseCardDocument` sync path; skip/error hard-block; warn syncs | v1 foundation |
| **2** | Built-in models in **one pass**: basic + cloze + reversible + typed | v1 |
| **2b** | `inferCloze` on both paths; auto-create built-ins + opt-out toggle | v1 |
| **2c** | TYP-05 multi-answer; model migration best-effort + summary / pre-sync counts | v1 |
| **3** | Custom note types + partial-field policy | **Deferred** |
| **4** | Polish: markers, CX-25/G4 doc+fixture fixes, stress-matrix expansion | Polish |

**Priority rank (05 D1):**

1. Wire `parseCardDocument` into sync (outcomes gate).  
2. All built-in Anki models one pass (no `:::r`/`:::t` Basic stopgap).  
3. `inferClozeFromManualSyntaxOnBasic` → preview **and** sync.  
4. Pre-sync summary + type-migration counts.  
5. Custom later (identify + not-implemented warning only in v1).

**Phase 1 settings surface (05 D4):** Hard-coded stock names; wire `inferCloze…`; auto-create built-ins opt-out. **No** full `anki_noteTypeMap` UI yet. **No** custom noteType sync cache work yet.

### Confirmed process locks (05)

| Item | Lock |
|------|------|
| **D3 test strategy** | Subset-first failing suite → expand under TDD until **all built-ins** have preview↔sync parity **within v1**. Full A1–O2 stress-matrix parity = stretch inside v1/Phase 4 — **not** a gate before first merge. |
| **Vault mix %** | **N/A** — do not bias engineering order by vault composition; prioritize product completeness. |
| **CX-25 + G4** | **CONFIRMED** fixes; doc/fixture polish when those files are touched — not a phase-1 sync-code blocker. |

### v1 success criteria (05 D6)

- Preview outcome **and** resolved type match what Anki gets for basic, cloze, reversible, typed.  
- `skip`/`error` never create/update; `warn` syncs with warnings in results.  
- Custom identified cards warn-not-implemented (not silent Basic).  
- Existing Basic vault still syncs; new types additive.  
- Pre-sync / summary surfaces type migrations (and mismatches if any short transition remains).

---

## 6 — Explicit NON-goals / deferred

Do **not** pull these into the shared-pipeline + built-ins pass unless a later decision re-opens them:

| Deferred | Until |
|----------|--------|
| Custom note type sync (payload + Anki fields) | Phase 3 |
| CUS partial / required-field policy | With custom sync (03 D6) |
| CUS-07 layout remapping (basic `:::` → custom fields via settings) | Later |
| Per-card YAML type blocks | Later |
| Reading mode preview parity | Later |
| Source mode decorations | Later |
| `anki_noteTypeMap` remapping UI | Later (stock names first) |
| Sync marker “in Anki” presence checks | Later only if cheap/optimized |
| Full A1–O2 stress-matrix as **pre-merge** gate | Never (stretch / Phase 4) |
| Intentional long preview↔sync mismatch period | **Forbidden** |
| Basic-only `:::r`/`:::t` stopgap then unblock | **Forbidden** — ship typed/reversible with built-ins |

**In v1 (do not defer):** TYP-05 multi-answer; model migration best-effort + summary; pre-sync mismatch/migration summary; behavioral CSS outcomes/types/garnish alignment via shared engine.

---

## 7 — Agent instructions (read this first)

1. **Treat this document as locked** for product behavior. If code and this contract disagree, **fix code** (or open an explicit new decision) — do not silently re-choose options from `_DecisionsNeeded_*`.  
2. **Do not re-open** D1–D7 in 01–05 unless the user starts a new decision round.  
3. Spec (`Card-Syntax-Spec.md`) may still say “error / skip” or “Deferred v2” in places; **this contract wins** for implementation (CLZ-11→error, TYP-05→v1, etc.). Propose Spec patches; another agent or pass may own Spec rule-text rewrites.  
4. **Do not edit stress fixtures** unless tasked (G4 repair is confirmed but owned separately).  
5. **Do not implement sync in a docs-only task.** Implementation follows TDD: failing tests → shared pipeline → built-ins.

---

## 8 — Source map (quick)

| Contract section | Decision file items |
|------------------|---------------------|
| §1 Outcomes | 01 D1–D6 |
| §2 Types / Anki | 02 D1–D7 |
| §3 Rules | 03 D1–D8 |
| §4 CSS | 04 D1–D7 |
| §5 Phasing | 05 D1–D7 + phase table |
| §6 Non-goals | 05 D5 (+ 02 D4, 03 D6, 04 D4) |
