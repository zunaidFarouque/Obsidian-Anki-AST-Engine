# HUMAN:

## My Idea

1. we already implemented the basic card.

```
#### Card name with #extra_tags_that #goes_into_anki

Basic card question prose

:::

Basic card answer prose
```

2. cloze is also easy to implement.

as the file is specifically used to create and manage the anki cards, so we can definitely use `{{}}` for cloze. existence of this means it is a cloze card

```
#### Card name with #extra_tags_that #goes_into_anki

Cloze card with some things {{c1::Hidden}}. it can have {{c2::N::Letter}} amounts of cloze, no problem.

:::

optional back extra prose
```

3. reversible cards

maybe this will be used by `::: r` or `:::r` (reserved)

```
#### Card name with #extra_tags_that #goes_into_anki

Reversible card question prose

:::r

Reversible card answer prose
```

4. type in the answer (I dont use it but I understand people use it so I am adding it)

maybe this will be used by `::: t` or `:::t` (reserved).

keep the back as the exact answer string (strip out all HTML)

```
#### Card name with #extra_tags_that #goes_into_anki

Type in answer card question prose

:::t

answer word/phrase
```

5. Custom card types with custom fields

If the user is advanced enough to use custom field, he knows how to handle the custom field names. so we do this. which Custom card type it belongs to is denoted by the specific hashtags #anki_card_CustomCardName or #anki/CustomCards/custom1. having the `anki_card` allows easily filtering the tag. or they can use hierarchy using `/` which lets navigation+filtering with hierarchy if they use notebook navigator or similar plugins. If frontmatter has `anki_customCardDefault` set to a specific custom card name, then it means the intention to use MOST/ALL of the cards with that type, so unless they explicitly override in card level by hashtags, every card with custom field name goes to that custom card type. (basically when users want to create separate files for their separate card types)

```
#### Card name with #extra_tags_that #goes_into_anki #anki_card_CustomCardName

:::field name 1

field 1 prose

::: field name 2

field 2 prose

::: field name 3

field 3 prose
```

later we will allow the default mapping to be remapped. like `basic card structure` -> `custom card type 1`

but that is for later

what do you think about my IDEA?

Please understand that the plugin is NOT YET PUBLISHED. So we can make drastic changes if needed. Please don't be anchored. if you think there is better way, tell me

We are still discussing. we still need to mature our main working style with the handling of the types.

We need to make sure things are intuitive and easy to use.

You ARE STILL ALLOWED/SOMEWHAT ENCOURAGED to GIVE ME EVEN BETTER ALTERNATIVES IF YOU CAN. ARGUE WITH ME WITH YOUR EXPERTISE AND BETTER IDEAS

DONT LOOK AT HOW IT WORKS TODAY (it will distract you). WE ARE DISCUSSING IDEAS. WE ARE READY TO OVERHAWL THE SYSTEM NOW. We cant do this type of thing later when we release the first version.

---

---

# AI:

Your proposal hangs together well. It extends one mental model—**`####` card + optional hashtags + delimiter-driven structure**—instead of bolting on separate systems per type. That's the right instinct for a pre-release overhaul.

Below is an honest critique: what I'd keep, what I'd tighten, and where I'd argue for something different.

---

## Overall Verdict

**Strong foundation.** The design is:

- **Local** — type cues live on or near the card, not buried in settings
- **Progressive** — basic stays simple; advanced features opt in
- **Obsidian-native** — hashtags in headings and dedicated files via frontmatter fit how people already organize notes

The main work isn't "is this good?" but **writing a strict type-resolution grammar** so nothing ambiguous slips through. Do that now, before v1.

---

## What's Especially Good

### 1. Basic Stays As-is

No reason to touch it. `:::` as the default split is already learned.

### 2. Cloze via `{{cN::…}}` Detection

For a file whose purpose is Anki cards, inferring cloze from Anki's own syntax is intuitive. Authors don't need a separate "this is cloze" declaration for the common case.

Pair it with optional `:::` → **Back Extra** on the Cloze model. That matches Anki and your basic pattern.

### 3. `:::r` And `:::t` as Reserved Delimiters

Better than a second syntax family. The delimiter already means "everything after this is the other side." Modifying the token (`:::r`, `:::t`) keeps that meaning and adds type in one place.

I'd **not** support `::: r` (space). It complicates parsing ("is `r` the mode or the start of the answer?") for little gain. Pick **`:::r` and `:::t` only**, document them, done.

### 4. Custom Types via `#anki_card_*` / `#anki/…`

Clever Obsidian integration:

- Visible in tag pane / search
- Hierarchical variants (`#anki/CustomCards/foo`) for Notebook Navigator–style workflows
- File default via `anki_customCardDefault` for "this whole file is my Vocab model"

### 5. `::: FieldName` For Custom Fields

Right call for advanced users. Named splits are **order-independent** and self-documenting—better than "third `:::` chunk = third Anki field."

---

## Where I'd Push back (Or rEfine)

### A. Cloze Auto-detect Needs an Escape Hatch

**Problem:** `{{c1::…}}` in a **basic** card (example text, docs, code samples) would flip the card to cloze.

**Fix — precedence, not removal of auto-detect:**

```
1. Card-level type hashtag (#anki_card_*, #anki/type/basic, etc.)
2. File frontmatter default (anki_customCardDefault, noteModelType, etc.)
3. Structural delimiter (:::t, :::r)
4. Cloze pattern in card body
5. Default → basic
```

If someone sets `#anki/type/basic` (or your reserved equivalent), **ignore** `{{cN::}}` for type detection (still compile it as literal text/HTML).

You need this escape hatch even if rare. Without it, one doc-style card breaks the model.

---

### B. Split "Anki tAgs" from "Engine dIrectives" in hAshtags

`#extra_tags` in the heading is nice. Reserved hashtags must **never** sync to Anki as tags.

| In heading | Meaning | Goes to Anki tags? |
|------------|---------|-------------------|
| `#biology` | User tag | Yes |
| `#exam-prep` | User tag | Yes |
| `#anki_card_Vocab` | Model selector | **No** (strip) |
| `#anki/type/basic` | Type override | **No** |
| `#anki/CustomCards/foo` | Model selector | **No** |

Define a reserved prefix: `#anki/` or `#anki_card_`. Everything matching that namespace is engine metadata, not Anki tags.

Otherwise users get polluted Anki tag trees and confusion ("why is `anki_card_Vocab` in my browser?").

---

### C. Hashtag Model Name ≠ Anki Model Name (Mapping lAyer)

`#anki_card_CustomCardName` won't always equal the exact Anki model string (`My Vocab Model`, spaces, punctuation).

You'll need one of:

1. **Convention** — hashtag suffix maps to model name by rules (underscores → spaces, etc.)
2. **Explicit map** — frontmatter or settings:

   ```yaml
   anki_modelMap:
     Vocab: "My Vocab Model"
     custom1: "JP-Vocabulary"
   ```

3. **AnkiConnect validation on sync** — "model `CustomCardName` not found; did you mean …?"

For v1, **(1) + (3)** is enough. Don't require users to edit JSON maps unless names diverge.

Same for built-ins: don't force `#anki_card_Basic (and reversed card)`. Built-ins should use **stable internal ids** (`basic`, `reversible`, `cloze`, `type`) that map to real Anki model names in config/settings.

---

### D. Type-in-answer: Document Stripping Hard

"Back = exact answer string, strip HTML" is right. Be explicit in the spec:

| Case | Behavior |
|------|----------|
| `answer` | `answer` |
| `**bold** answer` | `answer` (strip tags) |
| Multi-line back | Single line? First line only? Join with space? **Pick one.** |
| `café` vs `cafe` | Engine passes through; case/diacritics = Anki template |
| Multiple acceptable answers | Out of scope v1, or `answer1 \| answer2` later |

Recommendation: **first non-empty line, trimmed, tags stripped, entities decoded** (`&amp;` → `&`). Say that in docs so people aren't surprised.

---

### E. Custom Fields: Canonical Delimiter Form

Your example mixes:

```
:::field name 1
::: field name 2
```

Pick one canonical form. I'd use:

```
::: Field name 1
```

Rules:

- `:::` at line start (after optional whitespace)
- One space
- Rest of line = field name (trimmed, case-insensitive match to Anki fields)
- Body until next `::: Something` or next `####`

Reject unknown field names at sync time with a clear error (typo `Definiton` → "unknown field; model `Vocab` has: Word, Definition, …").

**Edge case:** field literally named `r` or `t` — rare. Parser rule: single token `r`/`t` only right after `:::` with no space = reserved; `::: r` or `::: my r field` = field name.

---

### F. Conflict Matrix (Must bE in the sPec)

| Signals | Result |
|---------|--------|
| `#anki_card_X` + `{{c1::}}` | Custom model X; cloze syntax is literal in a field |
| `:::r` + `{{c1::}}` | Error (or reversible wins; I'd **error**) |
| `:::t` + rich HTML back | Type-in-answer; strip to plain text |
| Custom + `:::r` | Error |
| Cloze + no `:::` | Text only; no Back Extra |
| Basic + no `:::` | **Decide:** front-only card (empty back) vs sync warning. I'd **warn** by default |

Ambiguity should **fail loud at sync**, not silently pick a type.

---

## Alternative I'd Seriously Consider: One `#anki/` Namespace for Everything

Your design mixes:

- **Inferred** type (cloze)
- **Delimiter** type (`:::r`, `:::t`)
- **Hashtag** type (`#anki_card_*`)

That can work, but you could unify **explicit** declarations:

```markdown
#### Card #biology #anki/type/reversible

Question
:::
Answer
```

| Hashtag | Effect |
|---------|--------|
| `#anki/type/basic` | Force basic |
| `#anki/type/cloze` | Force cloze (optional if auto-detect kept) |
| `#anki/type/reversible` | Reversible; keep plain `:::` |
| `#anki/type/typed` | Type-in-answer; keep plain `:::` |
| `#anki/model/Vocab` | Custom model + `::: Field` splits |

**Tradeoff:**

| Approach | Pros | Cons |
|----------|------|------|
| **Yours** (`:::r`, `:::t`, cloze detect) | Type visible at split; less heading clutter | Two ways to declare type |
| **Unified `#anki/type/*`** | One namespace; delimiter always `:::` | Reversible/type less obvious at split |
| **Hybrid (my recommendation)** | Best of both | Slightly more spec |

**Hybrid recommendation:**

- **Keep** cloze auto-detect + `::: Field` + `#anki/model/…`
- **Keep** `:::r` and `:::t` as shortcuts (nice at the split)
- **Also allow** `#anki/type/reversible` and `#anki/type/typed` in the heading for users who want all metadata in the title
- If both heading and delimiter disagree → **error**

That gives shorthand without forcing one authoring style.

---

## Reversible: `:::r` Vs Hashtag-only

`:::r` is good because reversible still uses Front/Back—the split matters.

Alternative `#reversible` in the heading is more visible in tag search but doesn't signal at the split.

**Keep `:::r`.** Optionally allow `#anki/type/reversible` as equivalent. Don't require both.

---

## File-level Defaults: Broaden Slightly

`anki_customCardDefault` is good for custom-only files. Mirror the pattern for built-ins:

```yaml
---
AnkiSync: on
anki_cardDefault: basic   # or cloze | reversible | typed | Vocab
---
```

Card-level `#anki/model/Vocab` or `#anki_card_Vocab` overrides file default.

One key name family (`anki_cardDefault` or `anki_defaultModel`) beats separate keys per type.

---

## What I Would *not* Do

1. **Per-card YAML blocks** for type — fights your delimiter/heading flow.
2. **Ordered `:::` splits without names** for custom — fragile when Anki field order changes.
3. **Different heading levels per field (H5)** as primary — you already use H4 for cards; adding H5 fields collides with footnotes/shared sections. Your `::: Field` approach avoids that.
4. **`::: r` with space** — parsing ambiguity for almost no benefit.

---

## Suggested "Card gRammar" v1 (Matured from yOur iDea)

```markdown
# File (optional)
---
AnkiSync: on
anki_cardDefault: Vocab    # built-in id or custom model id
---

# Card
#### Title #user-tag #anki/model/Vocab

::: Word
front-ish field 1

::: Definition
field 2 with {{c1::not-cloze}} when model is custom

# --- OR built-in variants ---

#### Cloze card #bio
Text with {{c1::hidden}} and {{c2::hint::answer}}
:::
Optional back extra

#### Reversible #bio
Question
:::r
Answer

#### Typed #bio
Question
:::t
exact answer phrase
```

**Resolution order:** card `#anki/model/*` or `#anki_card_*` → file `anki_cardDefault` → `:::t` / `:::r` → cloze regex → basic.

**Delimiter rules:** `:::` = split; `:::r` / `:::t` = split + type; `::: Name` = custom field boundary (only when custom model active).

---

## Bottom Line

Your idea is **good enough to build on**. The upgrades I'd insist on before implementation:

1. **Reserved hashtag namespace** — never sync `#anki_*` to Anki
2. **Explicit precedence ladder** — especially custom/basic override over cloze detect
3. **Canonical delimiter spelling** — `:::r`, `:::t`, `::: FieldName` (no `::: r`)
4. **Conflict = sync error**, not silent guess
5. **Model id → Anki model name** mapping layer (settings + validation)
6. **Typed-answer stripping rules** written down precisely

I would **not** overhaul away from your core shape (heading + hashtags + delimiter variants). I'd tighten the grammar and add the hybrid explicit hashtags so power users and shortcut users are both happy.

---

## Questions to Settle next

1. **Basic with no `:::`** — allowed (empty back) or warning?
2. **Cloze in file with `anki_cardDefault: cloze`** — still auto-detect, or require `{{}}`?
3. **Hashtag format** — prefer `#anki_card_Name` or hierarchical `#anki/model/Name` only (or both)?
4. **Built-in reversible/type** — delimiter-only, hashtag-only, or both equivalent?

Your answers lock the spec; then implementation is mostly parser + resolver + field compiler. When you want to implement, switch to Agent mode and we can TDD the resolver first (type detection tests before touching sync).

---

---

# HUMAN:

1. not allowed. this will not sync
2. require {{}}. because what word/phrase would be hidden as cloze if user doesnt define {{}}? if user is reluctant to write {{cn::cloze words}} OR {{cn::cloze words::optional hint}}, then do this: when `anki_cardDefault: cloze` OR `#anki/noteType/cloze` explicitly defined (that means we know the note type) then let user write {{cloze words}} or {{cloze words::optional hint}} without the `cn` thing. user can write one or more {{}} things, each will be AUTO NUMBERED+comapred with each other to find similarities and then unique things are numbered uniquely, same ones are numbered same, case insensitive… if an user wants to use manually numbering (c1, c2 etc when they want multiple instance of same word to be hidden) they can do that too.
3. let people choose their poison. default to #anki/model/Name or #anki/cardType/Name
4. Both equivalent

---

---

# AI:

Your answers lock in a **strict, fail-closed** grammar, which is the right call pre-v1. Here's how they fit together, what I'd still nail down, and where the auto-cloze numbering needs careful rules.

---

## Decisions → Spec (Your v1 gRammar)

| Rule | Your call | Effect |
|------|-----------|--------|
| Basic without `:::` | **Don't sync** | Clear error; no "front-only" ambiguity |
| Cloze without `{{}}` | **Don't sync** | Type alone isn't enough; content must declare deletions |
| Simplified `{{}}` | Only when type is **explicit** (file default or `#anki/…/cloze`) | Shorthand is opt-in, not magic everywhere |
| Auto-numbering | Same text → same `cN` (case-insensitive); unique texts → new numbers | Nice authoring UX |
| Manual `{{cN::…}}` | Always allowed | Power users keep full Anki control |
| Type hashtags | `#anki/model/Name` **or** `#anki/cardType/Name` (user choice) | Flexible; docs pick a default |
| Reversible / typed | `:::r` / `:::t` **and** hashtag equivalents | Both valid |

That's a coherent system. The risky part is **only #2 (auto cloze numbering)** — everything else is mostly policy.

---

## 1. No `:::` → Don't Sync

Good. Strict beats clever.

**UX detail:** sync report should say something like:

> `Card "Entropy"`: basic card missing `:::` delimiter — skipped

Same for cloze without `{{}}` when type is cloze (explicit or inferred — see below).

**One nuance:** for **custom** cards, the rule isn't `:::` but **at least one `::: FieldName` block** matching the model. Empty custom card = don't sync.

---

## 2. Cloze + Simplified `{{}}` + Auto-numbering

This is the strongest UX idea in the whole design — and the hardest to implement correctly.

### When is a Card "Cloze tYpe"?

You now have two paths:

| Path | Requires `{{}}`? | Simplified `{{word}}` allowed? |
|------|------------------|--------------------------------|
| **Implicit** — `{{c1::…}}` or `{{word}}` with `cN` in any deletion | Yes (with `cN`) | No — must use Anki form |
| **Explicit** — `anki_cardDefault: cloze` or `#anki/cardType/cloze` (or `#anki/noteType/cloze`) | Yes | Yes — `{{word}}`, `{{word::hint}}` |

**Recommendation:** drop **implicit cloze from bare `{{word}}`** unless type is explicit. Otherwise a basic file with `{{template vars}}` or `{{JSON}}` in prose becomes a footgun.

So:

- **Basic file:** only `{{cN::…}}` triggers cloze (Anki syntax only).
- **Cloze file / card:** `{{word}}` works with auto-numbering.

That matches "require `{{}}`" and your explicit-type shorthand.

### Auto-numbering Algorithm (Spec it eXactly)

Proposed rules:

1. **Scan** card body (respect code/math — same as delimiter checks).
2. **Parse** each `{{…}}`:
   - `{{cN::text}}` or `{{cN::text::hint}}` → manual; keep `cN`.
   - `{{text}}` or `{{text::hint}}` → auto (only if cloze type explicit).
3. **Normalize key** for grouping: `text.trim().toLowerCase()` — hints **don't** affect grouping (so `{{bank}}` and `{{bank::river}}` share one `cN`).
4. **Assign numbers:** walk in document order; first unseen key → next free `cN`; reuse existing `cN` for same key.
5. **Manual numbers:** never reassign; auto keys must not collide with manual text groups (if `{{c1::foo}}` exists, auto `{{foo}}` should merge into `c1`, not create a second group).
6. **Emit** canonical Anki form before compile/sync: `{{cN::text}}` or `{{cN::text::hint}}`.

**Edge cases to document:**

| Case | Behavior |
|------|----------|
| `{{Java}}` and `{{java}}` | Same `cN` (your rule) |
| Same word, different hints | Same `cN`; keep **first** hint seen (or error if hints differ — I'd **keep first**, warn in dry-run) |
| `{{c1::foo}}` + `{{foo}}` auto | Both → `c1` |
| `{{c1::foo}}` + `{{c2::foo}}` manual | Two groups (user wanted separate cards) |
| No `{{}}` but `#anki/cardType/cloze` | **Don't sync** |
| `{{}}` empty | **Don't sync** |
| Cloze + `:::r` / `:::t` | **Error** (conflicting types) |

**Optional back:** plain `:::` after cloze body → Back Extra (unchanged). Still required? I'd say **optional** for cloze — only `{{}}` is mandatory.

### Do You Still Want "Detect cLoze from `{{c1::}}`" on a bAsic-default fIle?

Yes — that's the escape hatch for mixed files without turning every `{{` into cloze:

```markdown
#### Mixed file card
Normal basic with {{c1::only Anki syntax}} in front? 
```

Actually on a basic-default file, `{{c1::x}}` in the question would imply cloze. That's fine — explicit Anki syntax is unambiguous.

**Summary for cloze:**

```
Explicit type (file/card) + {{word}}     → auto-number
Any file + {{cN::...}}                   → cloze (manual)
Explicit type + no {{}}                    → skip
Basic default + only {{word}} no cN        → treat as literal text OR skip? 
```

Last row is critical. I'd **treat as literal text** on basic-default files (don't sync as cloze, don't auto-hide). Otherwise `{{username}}` in a CS note breaks.

---

## 3. `#anki/model/` Vs `#anki/cardType/`

Letting people choose is fine; the **spec** should define roles:

| Hashtag | Meaning | Example |
|---------|---------|---------|
| `#anki/cardType/basic` | Built-in type | basic |
| `#anki/cardType/cloze` | Built-in type | cloze |
| `#anki/cardType/reversible` | Built-in type | reversible |
| `#anki/cardType/typed` | Built-in type | type-in-answer |
| `#anki/model/Vocab` | Custom Anki model id | maps via settings → `"My Vocab"` |

**Vocabulary:** you used both `noteType` and `cardType` in one message. Pick **one** term in docs and code — I'd use **`cardType`** for built-ins and **`model`** for custom Anki models.

**Conflicts:**

| Both present | Result |
|--------------|--------|
| `#anki/cardType/cloze` + `#anki/model/Vocab` | **Error** — cardType vs model are mutually exclusive |
| `#anki/model/Vocab` + `:::r` | **Error** |
| File `anki_cardDefault: cloze` + card `#anki/model/Vocab` | Card wins |

**Strip from Anki tags:** everything under `#anki/` never syncs to Anki.

---

## 4. Reversible / Typed — both Delimiter and Hashtag

Good. Add:

- If `#anki/cardType/reversible` **and** `:::r` on same card → OK (redundant), sync as reversible.
- If `#anki/cardType/reversible` **and** plain `:::` → OK (hashtag alone is enough).
- If `#anki/cardType/basic` **and** `:::r` → **Error**.

Typed answer: hashtag `#anki/cardType/typed` + plain `:::` works; back still stripped to plain text.

---

## Type Resolution Ladder (Updated with yOur aNswers)

```
1. Card hashtags (#anki/cardType/* or #anki/model/*)
2. File anki_cardDefault
3. Delimiter modifier (:::t, :::r)  →  sets type if not already set
4. {{cN::...}} in body  →  cloze
5. Default  →  basic

Then validate:
- basic     → must have :::
- reversible / typed  → must have ::: or :::r/:::t (split required)
- cloze     → must have {{}} (after auto-number pass, at least one valid deletion)
- custom    → must have ≥1 ::: FieldName matching model fields
```

No step allows sync without required structure.

---

## What I'd Still Argue (Lightly)

### A. `anki_cardDefault` Naming

You've used `cloze`, `anki_customCardDefault`, `anki_cardDefault`. Standardize on one frontmatter key:

```yaml
anki_cardDefault: basic | cloze | reversible | typed | <customModelId>
```

Custom ids match `#anki/model/<id>` suffix, not necessarily the Anki display name.

### B. Auto-numbering is Worth It, but Gate it

The feature is a **selling point** for cloze-heavy vaults. Keep it — but only under explicit cloze type. Don't auto-number in basic files.

### C. Consider a Single "Card sTatus" in sYnc oUtput

Because many cards may **skip** now:

```
Synced: 12 added, 3 updated
Skipped: 2 (missing :::), 1 (cloze without {{}})
```

Users will rely on this.

### D. Later Mapping (`basic structure → custom type`)

Your "later" remapping fits cleanly: same `::: Field` grammar, resolver maps built-in layout to custom field names in settings. No author syntax change.

---

## Mini Spec Card (Copy-paste rEady)

```markdown
#### Title #biology #anki/cardType/cloze

The {{mitochondria}} is the {{powerhouse::organelle}} of the cell.
:::
Extra back material (optional)

#### Title #anki/cardType/reversible
Question
:::r
Answer
# equivalent: #anki/cardType/reversible + :::

#### Title #anki/model/Vocab
::: Word
entropy
::: Definition
A measure of dispersal...

#### Title #anki/cardType/typed
Capital of France?
:::t
Paris
```

**Won't sync:** basic without `:::`; cloze without `{{}}`; custom without field blocks; conflicting type signals.

---

## Open Micro-questions (Last oNes before iMplementation)

1. **Basic file + `{{c1::x}}` only in back** — cloze or error? (I'd say: cloze only if `{{}}` appear in the **combined** card body before optional `:::` split, with Text = front+back before split per your layout.)
2. **Auto `{{word}}` on basic-default file** — literal text (recommended) or skip with warning?
3. **First-wins vs error** when same text has two different hints under auto-numbering?

If you align on those three, the grammar is implementation-ready. Your four answers are solid; the auto-cloze sugar is the one place to be picky in the spec so it doesn't surprise you in tests.

---

---

# HUMAN:

User can define card type in organizational headings.

for example:

```

# organizational heading 1

## organizational heading 2

### organizational heading 3

#### Card name

```

so they can:

```

### organizational heading 3 #anki/cardType/cloze

#### Card name (automatically it is cloze)

  

card content

  

#### Card name (automatically it is cloze)

  

card content

  

#### Card name #anki/cardType/basic (explicit override of card type)

  

basic card front content

  

:::

  

basic card back content

```

scan upwards to get the explicit card type declaration:

1. does this card have clear sign: explicit card type tag?
2. does the parent header explicitly define card type?
3. does the parent of parent header explicitly define card type? (go on)
4. does the document have default card type or default custom card type?

!!! I want to define two things in yaml (optional opt in): default card type, and default custom card type. custom card type property allows when user has a card with custom field declared but without the explicit hashtags. the default card property is equivalent to putting the tag on the heading 1 (all cards get explicitly get that same card declaration. any card with different card type formatting/layout without cardlevel/parent heading level declaration of separate card type will resolve to conflict)

---

Answers:

1. Basic file + {{c1::x}} only in back = basic. we dont take cloze from back side of the card
2. Auto {{word}} on basic-default file: Warn, but auto put to basic. if default type is declared as basic, it will be basic (literal {{}} ). if user explicitly states using tags (card level/heading level) that it is a cloze card, we can be sure and will send to cloze.
3. first wins.

dont rush. we are making good progress.

Discuss about the first thing that I said in this message

---

---

# AI:

Organizational heading inheritance fits your system well. It reuses the same idea you already have for **parent headers as Anki tag context**—but for **card type** instead of only tags. That's intuitive: "this section is cloze; these cards inherit it unless they say otherwise."

The important part is being precise about **outline tree semantics**, how that interacts with **two YAML defaults**, and when you **fail vs warn**. Below is a focused pass on that.

---

## Core Idea: Sections Declare Type, Cards Inherit

```markdown
### Thermodynamics #anki/cardType/cloze

#### Entropy
{{energy dispersal}} increases in isolated systems.

#### Enthalpy
{{heat content}} at constant pressure...

#### Quick check #anki/cardType/basic
What is ΔG?

:::

Gibbs free energy
```

A reader's mental model:

- "Under **Thermodynamics**, everything is cloze."
- "This one card is explicitly basic."

That's good UX. It matches how people already structure study notes (unit → subtopic → cards).

---

## Resolution Order (Your 1→4, tIghtened)

Your ladder is right. I'd phrase it as **outline walk**, not "scan headings in file order":

```
1. Card heading (H4) — #anki/cardType/* or #anki/model/*
2. Nearest ancestor heading above card level (H3, H2, H1) with a type tag
3. Next ancestor up, if still unresolved
4. File frontmatter defaults (only if steps 1–3 found nothing)
5. Implicit built-in default: basic (if no frontmatter either)
```

**Critical rule:** parent = **structural parent in the outline tree**, not "last `#anki/cardType/cloze` seen while reading downward."

```markdown
### Unit A #anki/cardType/cloze
#### Card 1          → cloze (parent: Unit A)

## Unit B            → no type tag
#### Card 2          → NOT cloze (parent chain: Unit B → …, never reaches Unit A)
```

Card 2 is **not** under Unit A in the tree, even though Unit A appeared earlier in the file. Same logic as parent-header tags today—inheritance must follow the AST/outline, not document-order memory.

---

## Only Headings *above* Card Level Carry Section Type

If `cardDeclarationHeadingLevel` is 4:

| Heading | Can declare section card type? |
|---------|--------------------------------|
| H1–H3 | Yes |
| H4 | Card line only (card-level override) |
| H5+ | No (field blocks / prose, not section type) |

If someone sets card level to H3, then H1–H2 are organizational; H3 is the card line. Section type tags belong on headings **shallower than** the card level.

Worth one sentence in the spec so it doesn't break when card level is configurable.

---

## Two YAML Defaults — Separate Jobs

You want two optional frontmatter keys. That's right; they solve different problems:

| Key | Role | Analog |
|-----|------|--------|
| `anki_cardDefault` | Built-in type for the file | `#anki/cardType/basic` on H1 |
| `anki_customCardDefault` | Custom model id when layout is custom | `#anki/model/Vocab` on H1 |

### How They Enter Resolution

Both are **step 4 only**—after card + ancestor headings.

Neither should override `### Section #anki/cardType/cloze` on a descendant card. Ancestor headings win over file defaults; file defaults win over implicit `basic`.

### How They Differ in *application*

**`anki_cardDefault`** — file-wide built-in contract (your words: equivalent to tagging H1):

- Applies to every card whose resolved type comes from step 4 (no heading/card declaration).
- If layout doesn't match that type → **conflict / don't sync** (not "guess").

**`anki_customCardDefault`** — custom model fallback, but tied to **layout**:

- Only applies when the card body uses `::: FieldName` blocks (custom shape).
- Card has `::: Word` / `::: Definition`, no `#anki/model/*` anywhere in the chain → resolve model from `anki_customCardDefault`.
- Card has plain `:::` only, no custom fields → **do not** apply custom default; use `anki_cardDefault` or `basic`.

So custom default is **layout-triggered**; built-in default is **file-contract triggered**.

### Both Set in Frontmatter

Recommend:

```yaml
anki_cardDefault: basic
anki_customCardDefault: Vocab
```

Not a conflict by itself. Conflict happens **per card** when body doesn't match the **resolved** type:

| Resolved type | Body | Result |
|---------------|------|--------|
| `basic` (from default) | `{{foo}}` only, no `:::` | conflict / skip |
| `basic` | `:::` present | OK |
| `cloze` (from ### section) | no `{{}}` | skip |
| custom `Vocab` (from custom default + field blocks) | only `:::` | conflict |
| `basic` | `::: Word` + `::: Definition` | conflict (custom layout without type/custom default) |

---

## Heading-level Type Vs Card-level Type

Your example is exactly the right pattern:

```markdown
### Week 2 #anki/cardType/cloze

#### Card A
{{mitochondria}} ...

#### Card B #anki/cardType/basic
Front

:::

Back
```

| Card | Resolved type | Why |
|------|---------------|-----|
| A | cloze | inherited from H3 |
| B | basic | card heading overrides section |

**Override rule:** card heading (step 1) always beats any ancestor (step 2+).

### Can a *shallower* Heading Override a Deeper Section?

```markdown
### Section #anki/cardType/cloze
#### Card A
{{foo}}

## Chapter #anki/cardType/basic
### Sub #anki/cardType/cloze
#### Card B
{{bar}}
```

For Card B, walk up from H4: H3 (cloze) → **stop**. Don't keep walking to `## Chapter (basic)`—first ancestor with a declaration wins.

For Card A under first ### only: H3 cloze → cloze. Good.

---

## Interaction with Your Three Answers (Fits cLeanly)

**1. Cloze only from "front" (pre-`:::`) content**

Section `cloze` + card with `:::` and `{{c1::x}}` only after `:::` → treat as **basic** (back is not scanned for cloze). If resolved type is `cloze` but all `{{}}` are only after `:::`, that's "cloze type + no valid cloze in Text" → **skip**.

**2. `{{word}}` on basic-default file**

Resolved `basic` + bare `{{word}}` without `cN` → **warn, render as literal**, don't sync as cloze. Section or card `#anki/cardType/cloze` → shorthand `{{word}}` allowed + auto-number.

**3. First hint wins**

Under auto-numbering, same text + different hints → first hint kept; optional dry-run notice.

Organizational headings don't change those; they only **set resolved type** earlier in the chain.

---

## Reserved Hashtags on Section Headings

Same rule as on card titles: `#anki/cardType/*` and `#anki/model/*` on `### Section` are **engine directives**, not Anki tags.

`#biology` on that heading can still flow to Anki tags (if you keep "heading hashtags → tags" for user tags). Parser should split:

- user tags → Anki
- `#anki/…` → type resolver only

---

## Conflicts You Should Define Explicitly

These will show up in real vaults:

| Situation | Suggested behavior |
|-----------|-------------------|
| `#anki/cardType/cloze` + `#anki/model/Vocab` on same heading | Error |
| Two `#anki/cardType/*` on same heading | Error |
| Resolved `basic`, body has `:::r` or `:::t` | Error (layout declares different type) |
| Resolved `cloze`, body has `:::r` / `:::t` | Error |
| Resolved `basic`, `{{c1::x}}` in front only | **Basic** (Anki syntax = literal text unless type is cloze) — aligns with #2 |
| Resolved `cloze`, only `:::` no `{{}}` | Skip |
| Resolved `custom`, no `::: Field` blocks | Skip |
| `::: Field` blocks, no model in chain, no `anki_customCardDefault` | Skip + "unknown custom layout" |
| Card `#anki/cardType/basic` under `### #anki/cardType/cloze` | OK — card wins |

**File default as strong contract** (your intent):

> `anki_cardDefault: basic` + card with cloze-style body and **no** section/card type declaration → **conflict**, not "helpful" cloze detection.

That's consistent and predictable.

---

## UX Wins

1. **Less repetition** — one `#anki/cardType/cloze` on `### Week 2` instead of every `####`.
2. **Matches outline studying** — section = topic = card style.
3. **Same skill as tags** — if users learn parent headers for `CS101::Week2`, they learn the same for card type.
4. **Override stays local** — one oddball basic card in a cloze section is one hashtag on the `####` line.

---

## UX Risks (Worth aDdressing in docs/UI)

1. **Invisible inheritance** — user opens `#### Card`, doesn't see it's cloze.
   - Dry-run line: `Card "Entropy" → cloze (from ### Thermodynamics)`
   - Optional plugin status: "section type: cloze"

2. **Wrong outline level** — `###` not actually parent of `####` in the tree (e.g. after a higher `#` reset).
   - Document with one diagram; sync warnings when inheritance looks accidental.

3. **Two defaults confusion** — users set only `anki_customCardDefault` and write basic `:::` cards.
   - Doc: "custom default ≠ all cards; only cards with `::: FieldName` blocks."

4. **`anki_cardDefault: cloze` on whole file** — user forgets `{{}}` on one card.
   - Skip with clear message; don't partial-sync the file silently.

---

## Alternative Considered: "Last dEclaration wIns" (Document oRder)

Some systems use "most recent `#cloze` above in file" without tree discipline. **Don't do that.** It breaks when users reorder sections and when `##` siblings reset context. Outline parent chain matches Obsidian's outline and your existing tag-path logic.

---

## Suggested Spec Snippet (Organizational tYpe oNly)

```text
Card type resolution (first match wins):
  1. Card heading: #anki/cardType/* or #anki/model/*
  2. Walk outline ancestors from card heading upward (H3→H2→H1):
     first heading with #anki/cardType/* or #anki/model/*
  3. If unresolved and body has ::: FieldName blocks:
     anki_customCardDefault (if set)
  4. If still unresolved:
     anki_cardDefault (if set)
  5. Else: basic

Section tags apply to all descendant cards at declaration level until:
  - a card-level type tag overrides, or
  - a closer ancestor declares a different type (outline tree only).

File anki_cardDefault is equivalent to #anki/cardType/<value> on the document root:
  layout must match resolved type or card is skipped with conflict reason.
```

Note step 3: I'd only apply `anki_customCardDefault` when **field blocks are present**, not for every card in the file. That matches your intent and avoids Vocab default leaking onto basic cards.

---

## One Design Choice Still Open

**Should `anki_customCardDefault` also be inheritable via a heading?**

e.g. `### Vocab deck #anki/model/Vocab` — I'd say **yes**, same as `#anki/cardType/cloze`. Custom and built-in use the same inheritance machinery; only the hashtag namespace differs (`cardType` vs `model`).

Then `anki_customCardDefault` in YAML is just "root-level `#anki/model/X` when nothing in the tree declared a model."

Symmetric and easy to explain.

---

## Bottom Line

Organizational heading inheritance is the right move. It scales better than per-card tags and matches how the rest of your grammar already thinks about headings.

The pieces to lock before implementation:

1. **Outline-tree parent walk** (not linear scan)
2. **Card level vs section level** (only shallower headings declare section type)
3. **Two YAML defaults** — built-in = file contract; custom = only when `::: Field` layout appears
4. **Conflict policy** — resolved type + body layout mismatch → skip with explicit reason
5. **`#anki/model/*` on section headings** — same inheritance as `#anki/cardType/*`

If you want to continue maturing one thread next, the highest-value follow-up is a **single worked example file** (mixed section: cloze block, basic override, custom subsection with `#anki/model/Vocab`, frontmatter defaults)—that stress-tests the tree and both YAML keys in one place. I can draft that in the next message if you'd like.
