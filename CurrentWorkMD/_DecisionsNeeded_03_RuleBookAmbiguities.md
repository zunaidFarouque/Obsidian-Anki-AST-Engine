# Rule Book Ambiguities

## Context

[Card-Syntax-Spec.md](../Docs/DECIDING/Card-Syntax-Spec.md) defines rules (BAS, CLZ, REV, TYP, CUS, CX). Preview/code mostly follow it; a few rules are ambiguous, deferred, or differ between spec text and implementation. Your answers here become the **canonical** behavior when we wire sync to `parseCardDocument`.

Preview/sync alignment: [01](./_DecisionsNeeded_01_PreviewSyncAlignment.md). Anki mapping: [02](./_DecisionsNeeded_02_CardTypesAnkiSync.md).

---

## D1 — BAS-06: error or skip?

**BLOCK**

Spec text says resolved `basic` + `:::r`, `:::t`, or `::: FieldName` → **error / skip** (both words). Matrix CX-09/10 says **error**. Code (`layoutValidator`) uses **error**.

**Why it matters:** Error vs skip changes chip (❌ vs ⛔) and whether sync runs (see file 01 D2).

**Example:**

```markdown
#### Wrong split
What is 2+2?
:::t
4
```

(Resolved **basic**, no typed tag.)

| Source | Outcome |
|--------|---------|
| Spec BAS-06 | error / skip (ambiguous) |
| Preview (today) | **error** |
| Sync (today) | Syncs Basic; `t` may leak into Back |

- [ ] **Option A — Error** (author must fix conflicting syntax)
- [ ] **Option B — Skip** (card ignored; softer)
- [ ] **Option C — Error in preview, skip in sync** (not recommended — violates alignment)
- [ ] **Other (write below):** ___

---

## D2 — CLZ-11: cloze only after `:::`

**BLOCK**

All `{{cN::…}}` only in Back region (after `:::`) → **skip** (no valid Text deletions).

**Why it matters:** Spec and code agree on **skip**; confirm you want this (not warn, not sync-as-basic).

**Example:**

```markdown
#### Too late #anki/cardType/cloze
Prose with no deletions in Text.
:::
{{c1::deletion only here}}
```

| Source | Outcome |
|--------|---------|
| Spec CLZ-11 / CX-12 | **skip** |
| Preview (today) | **skip** |
| Sync (today) | Basic-style split; cloze may land in Back only |

- [ ] **Option A — Skip** (spec + code — no Anki note)
- [ ] **Option B — Warn + sync as cloze** (move deletions to Text automatically — magic)
- [ ] **Option C — Error** (stronger than spec)
- [ ] **Other (write below):** ___

---

## D3 — TYP-05: multiple acceptable answers

**BLOCK**

Spec: **Deferred v2** — `Paris|Lyon` style answers out of scope. Code: uses rule id `TYP-05` for **formatting warn** on typed back (`**bold**`, links, etc.).

**Why it matters:** Same rule ID means two different things; confuses authors and tests.

**Example A (spec intent — deferred):**

```markdown
#### City #anki/cardType/typed
Capital of France?
:::t
Paris|Lyon|Marseille
```

**Example B (code today — formatting warn):**

```markdown
#### City #anki/cardType/typed
Capital of France?
:::t
**Paris**
```

- [ ] **Option A — Keep v1 as code today:** TYP-05 = formatting warn only; multi-answer stays deferred (new rule ID later).
- [ ] **Option B — Rename code rule:** Formatting warn → TYP-03b or similar; reserve TYP-05 for multi-answer when implemented.
- [ ] **Option C — Implement multi-answer now:** Pipe-separated synonyms in typed back (define Anki behavior).
- [ ] **Other (write below):** ___

---

## D4 — CX-25 matrix typo

**NICE-TO-HAVE**

CX-25 row says: `resolved cloze` + `{{c1::}}` in Text + optional `:::` → **sync** (rule CLZ-02). Empty `{{c1::}}` is **CLZ-09 skip**, not sync. Likely typo: should be `{{c1::x}}` (valid deletion) + optional Back Extra.

**Why it matters:** Fixture/docs drift causes wrong test expectations.

**Example (likely intended):**

```markdown
#### Valid cloze + extra #anki/cardType/cloze
The {{c1::mitochondria}} is key.
:::
Reference link here.
```

- [ ] **Option A — Fix spec:** CX-25 = valid Text deletion + optional `:::` (CLZ-02); reference CLZ-02 not empty cloze.
- [ ] **Option B — Add separate CX row** for empty `{{c1::}}` → skip (CLZ-09).
- [ ] **Option C — Leave spec; fix in implementation comments only**
- [ ] **Other (write below):** ___

---

## D5 — Reversible ↔ typed cross-delimiter (gap)

**BLOCK**

Matrix covers cloze + `:::r` (CX-30) and basic + `:::r` (CX-09). **Not specified:** both `:::r` and `:::t` on same card, or `#anki/cardType/reversible` with `:::t` (or vice versa).

**Why it matters:** `typeResolver` picks one type; layout may not catch all conflicts.

**Example A — two delimiters:**

```markdown
#### Confused
Question
:::r
Answer A
:::t
Answer B
```

**Example B — tag vs delimiter mismatch:**

```markdown
#### Mismatch #anki/cardType/reversible
Question
:::t
Answer
```

- [ ] **Option A — Error** (any conflicting reversible vs typed signals)
- [ ] **Option B — First wins** (DEL-08 style: first structural delimiter’s type)
- [ ] **Option C — Tag wins** (heading tag beats delimiter modifier)
- [ ] **Option D — Delimiter wins** (`:::t` overrides reversible tag)
- [ ] **Other (write below):** ___

---

## D6 — CUS partial fields (spec gap)

**BLOCK**

CUS-01 requires **≥1** matching `::: Field` block. Spec does **not** say what happens if Anki model has **required** fields that are missing (e.g. only `::: Word` when model needs Word + Definition).

**Why it matters:** Preview can show **sync** while Anki note is incomplete.

**Example:**

```markdown
#### Term #anki/noteType/Vocab

::: Word
mitochondria

(no Definition block)
```

(Anki `Vocab` model has: Word, Definition, Example)

| Source | Outcome |
|--------|---------|
| Preview (today) | **sync** (≥1 valid field) |
| Desired? | ??? |

- [ ] **Option A — Sync with empty missing fields** (Anki gets blank Definition)
- [ ] **Option B — Warn + sync** (chip ⚠️ “missing Definition”)
- [ ] **Option C — Skip** until all required fields present
- [ ] **Option D — Error** if any unknown or missing required field
- [ ] **Other (write below):** ___

**Which fields are “required” for your custom types?** ___

---

## D7 — CUS-04: plain `:::` on custom — skip wording

**NICE-TO-HAVE**

Spec: custom + only plain `:::` → **skip** / layout conflict. Code returns **skip** with CUS-04 message (message text says “skipped”).

**Example:**

```markdown
#### Bad custom #anki/noteType/Vocab
Front text
:::
Back text
```

- [ ] **Option A — Skip** (current behavior)
- [ ] **Option B — Error** (stricter — author used wrong layout)
- [ ] **Other (write below):** ___

---

## D8 — G4 fixture vs stress index (documentation)

**NICE-TO-HAVE**

Stress test index line says `G4 Section user/engine tags`; fixture `G4` is “Section tags split correctly” under `#biology` + cloze inheritance (STR-04, CX-29). Not a code bug — index label may be stale.

- [ ] **Option A — Rename index line** to match G4 fixture when we touch tests
- [ ] **Option B — Ignore** (low priority)
- [ ] **Other (write below):** ___

---

## Your notes / questions for me

```
(your notes here)
```
