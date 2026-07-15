# CSS — Cosmetic vs Behavioral

## Context

Three layers exist today:


| Layer                 | Location                                 | Role                                                       |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| **A — CSS**           | `plugin/styles.css`                      | Tint colors, badges, delimiter garnish, cloze token colors |
| **B — Preview logic** | `parseCardDocument` + editor decorations | Outcomes, chips, tooltips, which lines are “in” the card   |
| **C — Sync**          | `stateMachine` + `syncPipeline`          | What actually reaches Anki                                 |


Cosmetic differences are OK; **behavioral** signals (sync/skip/error/warn, card type, field boundaries) must match between preview and sync per your principle. See [01](./_DecisionsNeeded_01_PreviewSyncAlignment.md).

---



## D1 — Outcome tints (sync / skip / warn / error)

**BLOCK**

Card block background and chip suffix (⛔ ⚠️ ❌) — cosmetic or behavioral?

**Why it matters:** If behavioral, sync must honor the same outcome (file 01). If cosmetic only, authors could be misled.

**Example:** Yellow tint on entire card block + chip `basic ⚠️`.


| Element     | CSS class (examples)                | Drives sync today? |
| ----------- | ----------------------------------- | ------------------ |
| Block tint  | `anki-card-preview-cardblock--warn` | No                 |
| Chip suffix | `⚠️` on badge                       | No                 |


- [x] **Option A — Behavioral:** Tint/chip outcome must equal sync eligibility (same parser outcomes).
- [ ] **Option B — Cosmetic only:** Colors are hints; trust chip text + tooltip, sync separate until wired.
- [x] **Other (write below):** Please remember: Parser hasnt completed implementing e.g. typed sync. we need to do that.

---



## D2 — Delimiter garnish (`:::`, `:::r` ↕, `:::t` ⌨)

**BLOCK**

Preview decorates delimiter lines with icons/labels by **resolved type**. Sync does not read delimiter kind.

**Why it matters:** ↕ suggests “will sync as reversible”; today it may sync as Basic with a stray `r`.

**Example:**

```markdown
#### Pair #anki/cardType/reversible
Question
:::r
Answer
```


| Preview garnish                          | Sync behavior (today)                   |
| ---------------------------------------- | --------------------------------------- |
| `:::r` line shows reversible ↕ indicator | Splits at `:::`, `r` may appear in Back |


- [x] **Option A — Behavioral:** Garnish kind must match synced type (file 02).
- [ ] **Option B — Cosmetic until sync catches up:** Show garnish but add “preview only” in tooltip for non-basic types.
- [ ] **Option C — Hide garnish** for types not yet synced (only show `:::` split guide).
- [x] **Other (write below):** WE WILL IMPLEMENT THE TYPED SYNC NOW.

---



## D3 — Cloze token colors (groups c1, c2, …)

**NICE-TO-HAVE**

CSS colors cloze groups differently (`anki-card-preview-cloze-group-1`, etc.). Purely visual in preview.

**Why it matters:** Low risk — unless sync mis-parses cloze boundaries (separate from color).

**Example:**

```markdown
{{c1::mito}} and {{c2::ATP}}
```

- [x] **Option A — Always cosmetic** (Anki has its own cloze styling)
- [ ] **Option B — Cosmetic but must match** which spans are c1 vs c2 in synced HTML
- [ ] **Other (write below):** ___

---



## D4 — Sync marker setting (emoji / Anki icon on healthy cards)

**NICE-TO-HAVE**

`cardPreviewSyncMarker`: none | card-emoji | anki-icon on **sync** outcome only (Design Guidelines §5.3).

**Why it matters:** Could imply “this card is in Anki” vs “this card **will** sync.”

- [ ] **Option A — Cosmetic “will sync”** (parser says sync; does not check Anki)
- [ ] **Option B — Behavioral “in Anki”** (only show if `anki-id` exists and note found)
- [ ] **Option C — Keep off by default** (current default `none`)
- [x] **Other (write below):** I think this will increase the CPU load because we need to index which things are in anki. right? if so, we dont want to do that. we will definitely make it lightweight. a valid card appearence means it WILL be available upon sync, whether currently available or not. Although if there is an optimized way, we might add such feature later.

---



## D5 — Layout spacing (section extend, inter-card gap)

**NICE-TO-HAVE**

`cardPreviewSectionTopExtend`, `cardPreviewInterCardGapEm` — overlay-only spacing per Design Guidelines §5.2.2.

- [x] **Option A — Always cosmetic** (no sync impact)
- [ ] **Option B — Cosmetic but** card **range** for tint must match sync injection boundaries (already `ResolvedCard.range`)
- [x] **Other (write below):** Currently, syncing happens for H4 by default. the parser will remove unnecessary comments and horizontal markers ultimately. so CSS preview is ranging from start to valid content (not including the comments or horizontal rulers)

---



## D6 — Preview style: subtle vs explicit

**NICE-TO-HAVE**

Setting `cardPreviewStyle`: `subtle` (default) vs `explicit` — stronger borders/labels in explicit mode.


| Mode     | Skip/error visibility |
| -------- | --------------------- |
| subtle   | Faint tints           |
| explicit | Stronger chrome       |


- [x] **Option A — Pure preference** (outcomes identical; only CSS)
- [ ] **Option B — Explicit mode** should also surface sync-type mismatch banners (extra UI)
- [ ] **Other (write below):** ___

---



## D7 — What preview must NEVER do alone

**BLOCK**

Confirm boundaries so we don’t duplicate file 01.

**Which must share the same engine as sync (not CSS-only)?**


| Signal                        | Shared engine required? |
| ----------------------------- | ----------------------- |
| sync / skip / warn / error    | Tick: Yes / No          |
| Resolved type (basic/cloze/…) | Tick: Yes/ No           |
| Text vs Back vs field regions | Tick: Yes / No          |
| Cloze group colors            | Tick: Yes / No          |
| Delimiter garnish icons       | Tick: Yes / No          |
| Chip tooltip messages         | Tick: Yes / No          |


- [ ] **Option A — I agree:** Outcomes, type, and regions = **yes**; pure styling = **no** (fill table in notes if needed).
- [x] **Option B — Everything behavioral** except spacing/colors.
- [x] **Other (write below):** Everything currently works, I guess when we implement typed card sync, it will work the rest. Your below table is good.

---



## Comparison table — quick reference


| UI element                   | Likely cosmetic | Likely behavioral           |
| ---------------------------- | --------------- | --------------------------- |
| Yellow/red background tint   |                 | ✓ (reflects outcome)        |
| Chip text `cloze` vs `basic` |                 | ✓                           |
| `:::r` ↕ garnish             |                 | ✓ (implies reversible sync) |
| Cloze rainbow colors         | ✓               |                             |
| Inter-card gap em            | ✓               |                             |
| Tooltip “Problem: …” text    |                 | ✓                           |
| Sync emoji marker            | ✓ or ✓ (see D4) |                             |


---



## Your notes / questions for me

```
(your notes here)
```

