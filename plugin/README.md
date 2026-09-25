# Anki AST Sync (Obsidian Community Plugin)

A deterministic, AST-powered synchronization plugin bridging **Obsidian** and **Anki**.

Traditional sync tools rely on fragile Regular Expressions (Regex) that break when confronted with nested code blocks, LaTeX math formulas, callouts, HTML tables, or block transclusions (`![[Source#^block-id]]`). Even worse, regex tools often re-format your notes, destroying your whitespace and personal styling.

**Anki AST Sync** solves this by parsing your Markdown notes into an **Abstract Syntax Tree (AST)**. It understands the semantic structure of your notes, ensuring flawless, non-destructive synchronization with Anki while keeping your notes 100% clean and intact.

---

## ✨ Features

* **Deterministic AST Parsing:** Structural delimiters inside code blocks, math formulas, or inline code are safely ignored.
* **Non-Destructive Surgical ID Injection:** Injects tracking IDs (`&lt;!--anki-id: uuid--&gt;`) by calculating exact byte offsets on raw file buffers. It never re-serializes your Markdown through a formatter, preserving your formatting, whitespace, and custom syntax 100%.
* **Live Preview & Sync Parity:** Real-time CodeMirror 6 editor decorations display card envelopes, card types, and sync status badges (`SYNC`, `WARN`, `SKIP`, `ERROR`).
* **Write Hard-Gating:** Preview errors hard-block writes to Anki so malformed cards will never corrupt your Anki collection.
* **Deep Transclusion Resolution:** Automatically expands Obsidian block embeds (`![[Note#^block-id]]`) into flashcard fields prior to compile.
* **Local Media Syncing:** Detects images, PDFs, audio, and SVGs, converting them and uploading them to Anki via AnkiConnect.
* **Stock & Custom Card Types:** Supports stock Anki models (Basic, Reversible, Typed, Cloze) and user-defined custom note types (`#anki/noteType/...`).
* **Vault-Wide Duplicate Detection:** Scans your entire vault to warn against front collisions and answer mismatches before writing to Anki.
* **Interactive Diagnostics:** Click any Live Preview status badge to inspect the parsed AST fields, inherited tags, and exact validation messages.

---

## 📦 Prerequisites & Setup

### 1. Requirements
1. **Anki Desktop** running locally during synchronization.
2. **AnkiConnect** add-on installed in Anki (Add-on code: `2055492159`).

### 2. Configure AnkiConnect (CORS)
In Anki Desktop, go to **Tools → Add-ons → AnkiConnect → Config** and ensure your `webCorsOriginList` includes Obsidian:

```json
{
    "apiKey": null,
    "apiPort": 8765,
    "webCorsOriginList": [
        "http://localhost",
        "app://obsidian.md"
    ]
}
```

*(Restart Anki Desktop after modifying this configuration).*

---

## 🚀 Quick Start

1. Enable **Anki AST Sync** in Obsidian under **Settings → Community plugins**.
2. Open **Settings → Anki AST Sync** and click **Test connection** to verify Anki is reachable.
3. Create a note and enable synchronization by adding `AnkiSync: on` to your frontmatter:
   ```markdown
   ---
   AnkiSync: on
   target_anki_deck: General Knowledge
   file_anki_tags: geography, capitals
   ---

   #### What is the capital of Australia?
   :::
   Canberra
   ```
4. Run the command **Anki AST sync: Sync current note to Anki** (or click the ribbon icon to sync your entire vault).

---

## 📝 Card Syntax Reference

### Syntax Fundamentals
* **Card Heading Boundary:** Each flashcard begins at a heading level matching your configured level (default: `####` level 4) and spans until the next heading of equal or shallower depth.
* **Line-Start Delimiters:** Structural delimiters (`:::`, `:::r`, `:::t`, `::: FieldName`) **must be placed on their own line** (at line-start). Delimiters cannot be placed inline in the middle of a line or inside headings.
* **Code & Math Protection:** Delimiters inside code fences, inline code, or LaTeX math blocks (`$...$`, `$$...$$`) are ignored by the AST parser.

---

### 1. Basic Cards (`basic`)
Maps to Anki's standard **Basic** model (Fields: `Front`, `Back`). Requires a line-start `:::` delimiter.

#### Standard Question and Answer (Body Front)
```markdown
#### Binary Search
What is the time complexity of binary search in the worst case?
:::
O(log n) because the search space is halved in each step.
```

#### Heading as Front
When the `:::` delimiter immediately follows the heading (empty front body), the heading text itself is used as the Front:
```markdown
#### What is the speed of light in vacuum?
:::
Approximately 3 × 10⁸ m/s.
```

---

### 2. Reversible Cards (`reversible`)
Generates **two cards** in Anki (Card 1: Front → Back, Card 2: Back → Front) using the **Basic (and reversed card)** model.

#### Using `:::r` Delimiter (No Tag Needed)
```markdown
#### French Vocabulary
Bonjour
:::r
Hello
```
*(Heading-as-front is also supported when `:::r` immediately follows the heading).*

#### Using `#anki/cardType/reversible` Tag
```markdown
#### Chemical Elements #anki/cardType/reversible
Gold
:::
Au
```

---

### 3. Typed Answer Cards (`typed`)
Prompts you to type the answer in Anki's review screen using the **Basic (type in the answer)** model.

#### Using `:::t` Delimiter
```markdown
#### Linux Commands
What command prints the current working directory in Linux?
:::t
pwd
```

#### Multiple Acceptable Answers (`TYP-05`)
Separate alternative acceptable answers on the answer line with pipes (`|`):
```markdown
#### Capital of France
Name a major city in France:
:::t
Paris | Lyon | Marseille
```

#### Important Rules for Typed Cards
* **Single-line answer (`TYP-04`):** Only the first non-empty line of the Back region is tested. Subsequent lines are ignored and trigger a warning.
* **Plain text (`TYP-03`, `TYP-03b`):** Markdown/HTML formatting (bold, italics, links) is stripped; formatting triggers a warning badge.

---

### 4. Cloze Deletion Cards (`cloze`)
Maps to Anki's **Cloze** model (Fields: `Text`, `Back Extra`).

> [!IMPORTANT]
> **Cloze deletions MUST be in the Text region** (before `:::`, or the whole card body if no `:::` is present).
> **Never put `:::` before the cloze text** — that places the deletions in the Back Extra field and triggers a fatal `CLZ-11` error!

#### Standard Cloze (Without Back Extra)
```markdown
#### The Krebs Cycle #anki/cardType/cloze
The citric acid cycle takes place in the {{c1::mitochondrial matrix}} and generates {{c2::NADH}} and {{c3::FADH2}}.
```

#### Cloze with Optional Back Extra
Use `:::` after the cloze text to provide additional context or reference material:
```markdown
#### The Krebs Cycle #anki/cardType/cloze
The citric acid cycle takes place in the {{c1::mitochondrial matrix}} and generates {{c2::NADH}} and {{c3::FADH2}}.
:::
Extra reference: Discovered by Hans Krebs in 1937. It consists of eight enzymatic reactions.
```

#### Cloze Hints
Add hints using `::` inside the deletion:
```markdown
#### Organelles #anki/cardType/cloze
The {{c1::mitochondria::powerhouse organelle}} produces ATP.
```

#### Shorthand Cloze & Auto-Numbering (`CLZ-04`, `CLZ-05`)
Under a `#anki/cardType/cloze` heading or when `anki_cardDefault: cloze` is set, you can write shorthand `{{term}}` or `{{term::hint}}` without typing `c1::` or `c2::`. The engine automatically groups identical terms and numbers them in sequence:
```markdown
### Biochemistry #anki/cardType/cloze

#### Cellular Respiration
{{Glucose}} and {{oxygen}} produce {{carbon dioxide}} and water. Breakdown of {{glucose}} begins with glycolysis.
```
*Result:* Both `{{glucose}}` occurrences become `c1`, `{{oxygen}}` becomes `c2`, and `{{carbon dioxide}}` becomes `c3`.

---

### 5. Custom Anki Note Models (`custom`)
Synchronize cards directly to any custom Anki note model and field layout.

```markdown
#### Ephemeral #anki/noteType/Vocab
::: Word
ephemeral
::: Definition
Lasting for a very short time; transitory.
::: Example
Fashions are ephemeral, but style endures.
```

* **Field Delimiters (`DEL-04`):** Each field starts with `::: FieldName` at line-start, followed by exactly one space, then the field name matching your Anki model (case-insensitive).
* **Order Independent (`CUS-06`):** Fields can appear in any order.
* **Typo Protection (`CUS-02`):** If a field name does not match the Anki model, an error is surfaced showing valid field names.
* **File-Wide Default:** Add `anki_customCardDefault: Vocab` in frontmatter so any card with `::: FieldName` blocks resolves to `Vocab` without needing a heading tag.

---

### 6. Section Inheritance & Outline Tree Isolation
Headings shallower than the card declaration level (`#`, `##`, `###` when cards are `####`) can declare card or note types for an entire section:

```markdown
### Medical Vocabulary #anki/noteType/Vocab

#### Card 1
::: Word
prognosis
::: Definition
The likely course of a medical condition.

#### Card 2
::: Word
etiology
::: Definition
The cause or set of causes of a disease.
```

* **Card Heading Wins (`RES-01`):** A type tag on a card heading overrides any inherited section type.
* **Nearest Ancestor Wins (`RES-03`):** Nested sections inherit from the closest ancestor with a type tag.
* **Sibling Isolation (`RES-02`):** Sibling sections do not inherit tags from adjacent sections.

---

### 7. Reserved Hashtags vs User Tags
* **Engine Directives (`STR-04`):** Hashtags starting with `#anki/` (e.g. `#anki/cardType/cloze`, `#anki/noteType/Vocab`) or `#anki_card_*` are engine directives. They are used for type resolution and are **never** synced to Anki as tags.
* **User Tags:** Any other hashtags on headings (e.g. `#biology`, `#exam-2026`) ARE synced to Anki as tags.
* **Hierarchical Tags:** When `includeParentHeadersAsTags` is enabled, heading titles in the ancestor chain are concatenated into hierarchical tags (e.g. `Biology::Genetics`).

---

## ⚙️ Frontmatter Options

| Key | Values | Default | Description |
| :--- | :--- | :--- | :--- |
| `AnkiSync` | `on` / `off` / `true` / `false` | `off` | Enables or disables synchronization for this note. |
| `target_anki_deck` | Deck name | Settings default | Overrides the target Anki deck for all cards in this note. |
| `file_anki_tags` | `tag1, tag2` | `[]` | Comma-separated extra tags applied to all cards in this note. |
| `cardDeclarationHeadingLevel` | `1` to `6` | `4` | Heading level defining card envelopes for this note (default: `4` for `####`). |
| `delimiter` | `String` | `:::` | Overrides the card front/back delimiter for this note. |
| `includeParentHeadersAsTags` | `true` / `false` | `true` | Toggles hierarchical tags from ancestor headings. |
| `anki_cardDefault` | `basic`, `cloze`, `reversible`, `typed` | `basic` | Default built-in card type for cards without explicit delimiters. |
| `anki_customCardDefault` | Custom Note Type | — | Default custom note type (e.g. `Vocab`) when using `::: FieldName` blocks. |
| `anki_customLayoutMap` | Layout mapping table | — | Custom field mapping for remapping fields. |

---

## 👁 Live Preview Badges

When Live Preview is enabled in settings, cards in active notes display status badges beside headings:
* 🟢 **SYNC**: Valid card ready to sync.
* 🟡 **WARN**: Valid card that will sync, but has formatting warnings (e.g. formatting inside typed answer, bare mustache on basic card).
* ⚪ **SKIP**: Card is skipped (e.g. basic card missing `:::`, cloze card with no deletions in Text, duplicate front in vault).
* 🔴 **ERROR**: Structural error (e.g. cloze with `:::r`, deletions only in Back Extra, conflicting tags). **Writes to Anki are hard-blocked** to protect your collection. Click the badge to inspect diagnostics.

---

## ⌨️ Useful Commands

* **Sync current note to Anki** — Fast, single-file sync for the active note.
* **Sync vault to Anki** — Scans and synchronizes all eligible vault notes.
* **Dry-run sync current note / vault to Anki** — Simulates sync and displays actions without writing.
* **Check AnkiConnect connection** — Verifies Anki is reachable.
* **Create new Anki note** — Creates a note pre-populated with `AnkiSync: on` and a starter card.
* **Toggle Anki sync for current note** — Toggles `AnkiSync: on / off`.
* **Set target Anki deck for current note** — Select an Anki deck via fuzzy search.
* **Insert card template...** — Modal picker for Basic, Reversible, Typed, and Cloze templates.
* **Wrap selection as cloze deletion** — Wraps selected text in `{{c1::...}}` with auto-increment.
* **Jump to next / previous card in note** — Rapid navigation between card headings.
* **Jump to next card with sync issue** — Jumps directly to warnings or errors in the note.
* **Open current card in Anki desktop** — Locates and displays the active card in Anki Desktop.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
