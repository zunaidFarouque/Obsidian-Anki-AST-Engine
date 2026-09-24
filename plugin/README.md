# Anki AST Sync (Obsidian Community Plugin)

A deterministic, AST-powered synchronization plugin bridging **Obsidian** and **Anki**.

Traditional sync tools rely on fragile Regular Expressions (Regex) that break when confronted with nested code blocks, LaTeX math formulas, callouts, HTML tables, or block transclusions (`![[Source#^block-id]]`). Even worse, regex tools often re-format your notes, destroying your whitespace and personal styling.

**Anki AST Sync** solves this by parsing your Markdown notes into an **Abstract Syntax Tree (AST)**. It understands the semantic structure of your notes, ensuring flawless, non-destructive synchronization with Anki while keeping your notes 100% clean and intact.

---

## ✨ Features

* **Deterministic AST Parsing:** Structural delimiters inside code blocks, math formulas, or inline code are safely ignored.
* **Non-Destructive Surgical ID Injection:** Injects tracking IDs (`<!--anki-id: uuid-->`) by calculating exact byte offsets on the raw file buffer. It never re-serializes your Markdown through a formatter, preserving your formatting, whitespace, and custom syntax 100%.
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
   target_anki_deck: Spanish
   ---

   #### What is the capital of France?
   :::
   Paris
   ```
4. Run the command **Anki AST sync: Sync current note to Anki** (or click the ribbon icon to sync your entire vault).

---

## 📝 Card Syntax Reference

### Basic Card
```markdown
#### What is the powerhouse of the cell?
:::
The mitochondria produces ATP via cellular respiration.
```

### Inline Basic Card
```markdown
#### What is the speed of light in vacuum? ::: ~300,000 km/s
```

### Reversible Card (`:::r`)
Generates two cards in Anki (Front → Back and Back → Front):
```markdown
#### Bonjour :::r Hello
```

### Typed Answer Card (`:::t`)
Prompts you to type the answer in Anki to test spelling or code recall:
```markdown
#### What command lists directory contents in Linux?
:::t
ls
```

### Cloze Deletion Card
```markdown
#### Photosynthesis
:::
In plants, {{c1::chlorophyll}} absorbs light to convert {{c2::carbon dioxide}} and water into glucose.
```

### Custom Anki Note Model
Match any custom Anki note type and field layout using `#anki/noteType/<ModelName>`:
```markdown
#### Ubiquitous #anki/noteType/Vocabulary
::: Word
Ubiquitous
::: Definition
Present, appearing, or found everywhere.
::: Example
Smartphones have become ubiquitous in modern life.
```

---

## ⚙️ Frontmatter Options

| Key | Values | Description |
| :--- | :--- | :--- |
| `AnkiSync` | `on` / `off` | Enables or disables synchronization for this note. |
| `target_anki_deck` | Deck name | Overrides the target Anki deck for all cards in this note. |
| `anki_tags` | List of tags | Extra tags applied to all cards in this note. |
| `card_declaration_heading_level` | `1` to `6` | Overrides the card heading level for this note (default: `4` for `####`). |
| `delimiter` | `:::` | Overrides the card front/back delimiter for this note. |
| `anki_cardDefault` | `basic`, `cloze`, `reversible`, `typed` | Default card type for cards without explicit delimiters. |

---

## 👁 Live Preview Badges

When Live Preview is enabled in settings, cards in active notes display status badges:
* 🟢 **SYNC**: Valid card ready to sync.
* 🟡 **WARN**: Valid card that will sync, but has formatting warnings.
* ⚪ **SKIP**: Card is skipped (e.g. duplicate front or empty back).
* 🔴 **ERROR**: Structural error. Write to Anki is hard-blocked to protect your collection. Click the badge to inspect diagnostics.

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
