# Card Types — Anki Sync Implementation

## Context

Preview already resolves **basic**, **cloze**, **reversible**, **typed**, and **custom** note types. Sync today uses one setting: `noteModelName` (default `"Basic"`) and always sends Front + Back. `config.json` schema even restricts `noteModelType` to `"basic"` only. To honor preview chips, sync must create/update the correct Anki models and fields.

Alignment rules: see [01 Preview ↔ Sync](./_DecisionsNeeded_01_PreviewSyncAlignment.md).

---

## D1 — Which card types in the first implementation pass?

**BLOCK**

You said you want non-basic types implemented, not just preview decoration. What ships in **v1 of multi-type sync**?

**Why it matters:** Scope drives engineering order and settings UI.

| Type | Preview today | Sync today |
|------|---------------|------------|
| basic | ✅ | ✅ Basic model |
| cloze | ✅ | ❌ Basic only |
| reversible | ✅ | ❌ Basic only |
| typed | ✅ | ❌ Basic only |
| custom | ✅ (needs noteType cache) | ❌ Basic only |

- [ ] **Option A — All built-ins:** basic + cloze + reversible + typed in one pass; custom later.
- [ ] **Option B — Cloze first:** Cloze is highest pain (literal `{{c1::}}` in Anki); others follow.
- [ ] **Option C — Cloze + reversible:** Typed and custom in phase 2.
- [ ] **Option D — Full parity:** All built-ins + custom in first pass.
- [ ] **Other (write below):** ___

---

## D2 — Anki note type name mapping (built-ins)

**BLOCK**

Spec defaults (Card-Syntax-Spec §2). What are **your** Anki model names?

**Why it matters:** AnkiConnect `addNote` needs exact model names from your collection.

**Example mapping table — fill in or tick defaults:**

| Internal id | Spec default Anki name | Your Anki model name |
|-------------|------------------------|----------------------|
| `basic` | Basic | |
| `cloze` | Cloze | |
| `reversible` | Basic (and reversed card) | |
| `typed` | *(not in spec default table — you choose)* | |

- [ ] **Option A — Use spec defaults** (create models in Anki if missing).
- [ ] **Option B — Custom names** (write in table above; plugin needs `anki_noteTypeMap` setting).
- [ ] **Option C — Single “Obsidian” family** (e.g. `Obsidian Basic`, `Obsidian Cloze`, …).
- [ ] **Other (write below):** ___

**Typed model name (if you use typed cards):** ___

---

## D3 — Field mapping per built-in type

**BLOCK**

How should regions map to Anki fields?

**Why it matters:** Wrong mapping breaks cards silently (e.g. cloze text in Back Extra only).

**Example — cloze with Back Extra (CLZ-02):**

```markdown
#### Cell #anki/cardType/cloze
The {{c1::mitochondria}} produces ATP.
:::
Extra diagram link here.
```

| Region | Expected Anki field |
|--------|----------------------|
| Text (before `:::`) | `Text` (cloze deletions here) |
| After `:::` | `Back Extra` |

**Basic / reversible / typed — confirm or edit:**

| Type | Text region → | Back region → | Notes |
|------|---------------|---------------|-------|
| basic | Front | Back | |
| reversible | Front | Back | Same fields; Anki generates reverse card |
| typed | Front | Back (plain text per TYP-03/04) | Strip HTML to plain text |
| cloze | Text | Back Extra (optional) | |

- [ ] **Option A — Spec mapping as table above**
- [ ] **Option B — Custom field names** (list per type below)
- [ ] **Other (write below):** ___

---

## D4 — Custom note types (`#anki/noteType/Vocab`)

**BLOCK**

Custom cards use `::: FieldName` blocks. Sync must map to Anki fields from the note type cache.

**Why it matters:** Preview already validates field names (CUS-02); sync must send the right payload.

**Example:**

```markdown
#### Mitochondria #anki/noteType/Vocab

::: Word
mitochondria

::: Definition
Powerhouse of the cell; produces ATP.

::: Example
The mitochondria in muscle cells are abundant.
```

- [ ] **Option A — Phase 2:** Built-ins first; custom cards stay preview-only until cache + sync wired.
- [ ] **Option B — Same pass as built-ins:** Custom included if noteType cache is populated.
- [ ] **Option C — Custom only for explicit tags:** `#anki/noteType/X` syncs custom; orphan `::: Field` stays skip (CUS-03).
- [ ] **Other (write below):** ___

**Primary custom note types you use (names):** ___

---

## D5 — Auto-create missing Anki models?

**BLOCK**

If mapped model name doesn’t exist in Anki, should sync create it?

**Why it matters:** `autoCreateDecks` exists today; models are different (fields, templates, cloze type flag).

- [ ] **Option A — Fail with clear error:** “Model Cloze not found — create in Anki or fix map.”
- [ ] **Option B — Auto-create built-ins only:** Use Anki’s stock templates where possible.
- [ ] **Option C — Auto-create all mapped types:** Including custom from cache field list.
- [ ] **Other (write below):** ___

---

## D6 — One card → wrong model already in Anki

**NICE-TO-HAVE**

If `<!-- anki-id: … -->` links to a Basic note but preview now resolves **cloze**, what should sync do?

**Why it matters:** Type migration is easy to get wrong and destructive.

**Example:** Card edited from basic layout to cloze deletions; same `anki-id`.

- [ ] **Option A — Block:** Error until user removes id or fixes type manually in Anki.
- [ ] **Option B — Delete + recreate:** Remove old note, add new (loses review history).
- [ ] **Option C — Update in place if Anki allows:** Best-effort model change via AnkiConnect.
- [ ] **Option D — Sync as old model:** Keep Basic until user clears id.
- [ ] **Other (write below):** ___

---

## D7 — Typed answer: HTML stripping depth

**NICE-TO-HAVE**

TYP-03 says strip HTML for typed Back. How aggressive?

**Example:**

```markdown
#### Capital #anki/cardType/typed
Capital of France?
:::t
**Paris** with <sub>accent</sub>
```

| Layer | Preview | Expected Back value |
|-------|---------|---------------------|
| Preview | `typed` sync | `Paris with accent` or `Paris`? |

- [ ] **Option A — First line, strip all HTML** (spec TYP-04)
- [ ] **Option B — Strip formatting only, keep text** (`**Paris**` → `Paris`)
- [ ] **Option C — Literal HTML to Anki** (Anki types plain text; may fail matching)
- [ ] **Other (write below):** ___

---

## Your notes / questions for me

```
(your notes here)
```
