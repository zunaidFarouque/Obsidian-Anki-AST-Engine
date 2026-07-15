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


| Source          | Outcome                             |
| --------------- | ----------------------------------- |
| Spec BAS-06     | error / skip (ambiguous)            |
| Preview (today) | **error**                           |
| Sync (today)    | Syncs Basic; `t` may leak into Back |


- [ ] **Option A — Error** (author must fix conflicting syntax)
- [ ] **Option B — Skip** (card ignored; softer)
- [ ] **Option C — Error in preview, skip in sync** (not recommended — violates alignment)
- [x] **Other (write below):** PREVIEW TODAY IS NOT ERROR. IT DETERMINES THE TYPED TYPE PERFECTLY. YOU ARE WRONG. ONLY SYNC TYPES ARE NOT IMPLEMENTED YET. CSS SHOWS IT AS `typed`.

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


| Source              | Outcome                                        |
| ------------------- | ---------------------------------------------- |
| Spec CLZ-11 / CX-12 | **skip**                                       |
| Preview (today)     | **skip**                                       |
| Sync (today)        | Basic-style split; cloze may land in Back only |


- [ ] **Option A — Skip** (spec + code — no Anki note)
- [ ] **Option B — Warn + sync as cloze** (move deletions to Text automatically — magic)
- [x] **Option C — Error** (stronger than spec)
- [x] **Other (write below):** BECAUSE IT IS EXPLICITLY ADDED USING TAG THAT IT IS A CLOZE, IT HAS TO BE A VALID CLOZE. BUT USER DIDNT ENTER VALID ONE SO ERROR.

---



## D3 — TYP-05: multiple acceptable answers

**BLOCK**

Spec: **Deferred v2** — `Paris|Lyon` style answers out of scope. Code: uses rule id `TYP-05` for **formatting warn** on typed back (`**bold`**, links, etc.).

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
- [x] **Option C — Implement multi-answer now:** Pipe-separated synonyms in typed back (define Anki behavior).
- [x] **Other (write below):** Implement. `Paris|Lyon|Marseill` and `Paris | Lyon | Marseille` should both create 3 acceptable answers. strip out the spaces attached with `|`. Let user add space for their ease of read/adding. so, `Answer one | Answer two` -> valid answers: `Answer one` and `Answer two` .

---



## D4 — CX-25 matrix typo

**NICE-TO-HAVE**

### Plain explanation (why this looks like a typo)

The **cross-rule matrix** row CX-25 currently says:

| Id | Scenario text (as written) | Outcome | Points at |
|----|----------------------------|---------|-----------|
| CX-25 | resolved `cloze` + **`{{c1::}}`** in Text + optional `:::` | **sync** | CLZ-02 |

But elsewhere the rule book already says:

| Rule | What empty means | Outcome |
|------|------------------|---------|
| **CLZ-09** | `{{}}` or `{{c1::}}` with **empty** deletion text | **skip** |
| **CX-28** | `{{}}` empty | **skip** (CLZ-09) |

So CX-25 as written claims “empty cloze → sync,” which **contradicts** CLZ-09 / CX-28. The row is *trying* to document **CLZ-02** (optional Back Extra on a **valid** cloze), not empty deletions.

**Side-by-side examples:**

```markdown
# ❌ What CX-25 literally says today (WRONG vs CLZ-09)
#### Empty deletion #anki/cardType/cloze
Nothing {{c1::}} here.
:::
optional extra

# → MUST be skip (CLZ-09 / CX-28). Must NOT sync.
```

```markdown
# ✅ What CX-25 almost certainly meant (matches CLZ-02 + fixture B4)
#### Valid cloze + extra #anki/cardType/cloze
The {{c1::mitochondria}} is key.
:::
Reference link here.

# → sync as Cloze; Back Extra optional. Stress fixture B4 already uses non-empty {{entropy}}.
```

Empty stay under CLZ-09 / CX-28 — no new row required unless you want an explicit `{{c1::}}` twin of `{{}}`.

- [x] **CONFIRMED — Option A:** Fix matrix typo so CX-25 = **non-empty** Text deletion (e.g. `{{c1::x}}` or `{{c1::mitochondria}}`) + optional `:::` → **sync** (CLZ-02). Empty `{{c1::}}` / `{{}}` stays **skip** via CLZ-09 / CX-28.
- [ ] **Option B — Also add** a dedicated CX row for empty `{{c1::}}` → skip (redundant with CX-28 unless you want symmetry).
- [ ] **Option C — Leave spec;** only note in comments (not recommended — matrix stays self-contradictory).

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

- [x] **Option A — Error** (any conflicting reversible vs typed signals)
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


| Source          | Outcome                   |
| --------------- | ------------------------- |
| Preview (today) | **sync** (≥1 valid field) |
| Desired?        | ???                       |


- [ ] **Option A — Sync with empty missing fields** (Anki gets blank Definition)
- [ ] **Option B — Warn + sync** (chip ⚠️ “missing Definition”)
- [ ] **Option C — Skip** until all required fields present
- [ ] **Option D — Error** if any unknown or missing required field
- [x] **Other (write below):** Custom types will be implemented later. so decide later.

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

- [x] **Option A — Skip** (current behavior)
- [ ] **Option B — Error** (stricter — author used wrong layout)
- [ ] **Other (write below):** ___

---



## D8 — G4 fixture vs stress index (STR-04 / CX-29)

**NICE-TO-HAVE**

### Plain explanation (what’s wrong)

**Spec intent (CX-29 / STR-04):** A **section** heading can carry a normal user tag (`#biology`) **and** an engine tag (`#anki/cardType/cloze`). Sync should:

- resolve type **cloze** from the engine tag
- put Anki tag **`biology`** only (user hashtag)
- **strip** `anki/cardType/cloze` (engine directive — not an Anki tag)

```markdown
### Thermodynamics #biology #anki/cardType/cloze

#### Example card
{{ATP}} in cells.

# Expect: sync cloze; Anki tags include biology; NOT anki/cardType/cloze
```

**What the stress fixture does today:**

| Piece | Reality |
|-------|---------|
| Index line | `G4 Section user/engine tags → sync (STR-04, CX-29)` — **correct intent** |
| Card title | `#### G4 Section tags split correctly` |
| Parent heading | `### Edge gallery #anki/cardType/cloze` — **cloze only, no `#biology`** |
| Expect comment | claims `#biology on ### Thermodynamics syncs` |

`### Thermodynamics #biology #anki/cardType/cloze` is way up in **section B**. By the time G4 appears under **section G**, that ancestor is long closed. So the expect comment is **lying about `#biology`**, and the card does **not** actually exercise CX-29’s user-tag half.

```markdown
# ❌ Today (under Edge gallery — no #biology)
## G — Edge cases
### Edge gallery #anki/cardType/cloze
#### G4 Section tags split correctly
{{ATP}} in cells.
<!-- falsely expects #biology from Thermodynamics -->

# ✅ After repair (ancestor must carry BOTH tags)
### Tag split demo #biology #anki/cardType/cloze
#### G4 Section tags split correctly
{{ATP}} in cells.
<!-- expect: sync; STR-04,CX-29; Anki tags: biology; strip anki/cardType/cloze -->
```

(Index wording “user/engine tags” can stay; optionally align the card title. No product-code bug — fixture / docs repair.)

- [x] **CONFIRMED — Repair fixture:** Move G4 (or retag its parent) so the nearest section ancestor has **`#biology` + `#anki/cardType/cloze`**, and fix the expect comment to match. Keep index intent (STR-04 / CX-29). Optionally rename the card title to match the index.
- [ ] **Option A only — Rename index** to the fixture title and drop CX-29 claim (weaker — loses the user-tag test).
- [ ] **Option B — Ignore** (low priority; leave wrong expect until someone fails a real test).

---



## Your notes / questions for me

```
D4 (CX-25) + D8 (G4): CONFIRMED (user accepted defaults).
Doc/fixture polish when touching those files — not a phase-1 sync-gate blocker.
```

