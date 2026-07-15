# Preview ↔ Sync Alignment

## How to use these files

1. Open each `_DecisionsNeeded_*.md` file in order (01 → 05).
2. For each question, tick **one** checkbox (or write under **Other**).
3. You can leave questions blank — mark them with `?` in Your notes if you want to discuss later.
4. **BLOCK** = implementation cannot proceed safely without your answer. **NICE-TO-HAVE** = polish or later phase.
5. Other files cross-reference instead of repeating the same question — follow links when you see them.

---

## Context

Card preview (`parseCardDocument`) understands basic, cloze, reversible, typed, and custom cards and shows outcomes: **sync**, **skip**, **warn**, **error**. Live Anki sync today uses `stateMachine` only: every card becomes a **Basic** note with Front/Back HTML. Preview can show `cloze` with a sync tint while Anki still gets Basic — a behavioral mismatch.

Your stated principle: *If the UI means something to the user, logic must match.*

---

## D1 — Core alignment principle

**BLOCK**

When preview shows an outcome chip (sync / skip / warn / error), what must sync do?

**Why it matters:** This is the north star for every other decision in these files.

**Example:**

```markdown
#### Mitochondria #anki/cardType/cloze
The {{c1::powerhouse}} of the cell.
```

| Layer | Current behavior |
|-------|------------------|
| Preview | Chip: `cloze` (sync tint) |
| Sync | Creates/updates **Basic** note; `{{c1::…}}` may appear literally in Front |

- [ ] **Option A — Strict mirror:** Preview outcome is authoritative. `skip`/`error` never sync. `warn` syncs but surfaces warnings in sync results. `sync` uses the resolved type (cloze, reversible, etc.).
- [ ] **Option B — Block on bad, allow type lag:** `skip`/`error` never sync; `warn`/`sync` sync today as Basic until multi-type sync ships (preview may show wrong type temporarily).
- [ ] **Option C — Preview is advisory only:** Sync always attempts Basic extraction; preview is author guidance only (document the mismatch).
- [ ] **Other (write below):** ___

---

## D2 — Skip and error must block sync

**BLOCK**

If preview marks a card **skip** or **error**, should sync touch that card at all?

**Why it matters:** Today sync ignores preview outcomes and may still add/update the card in Anki.

**Example (error):**

```markdown
#### Conflict
Question
:::r
Answer
```

(No `#anki/cardType/reversible` — resolved **basic** + `:::r` → preview **error** BAS-06)

| Layer | Current behavior |
|-------|------------------|
| Preview | `basic ❌` |
| Sync | Still splits at `:::` and syncs as Basic; stray `r` may appear in Back |

- [ ] **Option A — Hard block:** `skip` and `error` cards are excluded from sync entirely (no add/update).
- [ ] **Option B — Block error only:** `error` blocks; `skip` still syncs (not recommended — contradicts chip).
- [ ] **Option C — Soft block:** Sync runs but shows a confirmation / dry-run warning for mismatched cards.
- [ ] **Other (write below):** ___

---

## D3 — Warn vs sync

**BLOCK**

If preview shows **warn** (e.g. `{{c1::x}}` on a basic card with default settings), should sync proceed?

**Why it matters:** Warn means “will sync, but something is off.” Sync must either match that or upgrade warn to skip/error.

**Example:**

```markdown
#### Literal cloze on basic
The {{c1::answer}} is here.
```

| Layer | Current behavior |
|-------|------------------|
| Preview | `basic ⚠️` (BAS-04 — literal cloze on basic) |
| Sync | Syncs as Basic; cloze syntax in Front HTML |

- [ ] **Option A — Warn syncs:** Proceed; include warning in sync results modal.
- [ ] **Option B — Warn blocks until fixed:** Treat as skip until author fixes or enables a setting (see D4).
- [ ] **Option C — Depends on warning rule:** Some warns sync, some skip (list rules in notes).
- [ ] **Other (write below):** ___

---

## D4 — `inferClozeFromManualSyntaxOnBasic` setting

**BLOCK**

Settings label says this toggle “matches sync resolver BAS-04,” but sync does **not** read this setting today — only preview does.

**Why it matters:** Authors may enable it expecting Anki cloze notes; sync still sends Basic.

**Example:**

```markdown
#### Auto cloze?
{{c1::Photosynthesis}} in chloroplasts.
```

| Setting | Preview | Sync (today) |
|---------|---------|--------------|
| `false` (default) | `basic ⚠️` | Basic, literal `{{c1::…}}` |
| `true` | `cloze` sync | Basic, literal `{{c1::…}}` |

- [ ] **Option A — Affects both:** When enabled, preview **and** sync treat card as cloze (requires cloze Anki model — see file 02).
- [ ] **Option B — Preview only:** Rename/describe setting honestly; sync unchanged until multi-type sync.
- [ ] **Option C — Remove setting:** Always use explicit `#anki/cardType/cloze` or inheritance; no inference toggle.
- [ ] **Other (write below):** ___

---

## D5 — `:::r` / `:::t` on cards synced as Basic today

**BLOCK**

Sync’s delimiter check matches `:::` via `indexOf`, so `:::r` and `:::t` split like `:::` but can leave **`r`** or **`t`** in the Back field.

**Why it matters:** Preview shows reversible/typed garnish; sync may produce garbage Back text.

**Example:**

```markdown
#### Vocab
What is ATP?
:::r
Adenosine triphosphate
```

| Layer | Current behavior |
|-------|------------------|
| Preview | `reversible` (or error if basic) with ↕ garnish on `:::r` |
| Sync | Basic note; Back may start with `r` then newline, or whole line mishandled |

- [ ] **Option A — Block until typed sync:** Cards with `:::r`/`:::t` are skip/error in sync until reversible/typed models ship (file 02).
- [ ] **Option B — Strip suffix:** Treat `:::r`/`:::t` as `:::` for Basic sync and strip trailing `r`/`t` from delimiter line (stopgap).
- [ ] **Option C — Ignore line:** If resolved type isn’t reversible/typed, treat `:::r`/`:::t` as non-delimiter text (no split).
- [ ] **Other (write below):** ___

---

## D6 — Sync results must report preview conflicts

**NICE-TO-HAVE**

When sync and preview would disagree (during any transition period), how should the plugin tell you?

**Why it matters:** Reduces silent wrong notes in Anki.

- [ ] **Option A — Per-card row in sync results:** “Preview: cloze / Synced: Basic”
- [ ] **Option B — Pre-sync summary dialog:** Count of mismatched cards before run
- [ ] **Option C — No extra UI:** Fix alignment first (D1), no transitional messaging
- [ ] **Other (write below):** ___

---

## Your notes / questions for me

_Use this space for anything unclear, vault examples, or “decide later” markers._

```
(your notes here)
```
