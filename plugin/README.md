# Anki AST Sync

A deterministic, AST-powered synchronization pipeline bridging **Obsidian** and **Anki**.

Traditional sync tools rely on fragile Regular Expressions (Regex) that break when confronted with nested code blocks, LaTeX math, HTML tables, or block transclusions (`![[Source#^block-id]]`).

**Anki AST Sync** solves this by parsing your Markdown notes into an **Abstract Syntax Tree (AST)**. It understands the semantic structure of your notes, ensuring flawless, non-destructive synchronization with Anki while keeping your notes clean.

---

## ✨ Features

* **Deterministic AST Parsing:** Structural delimiters inside code blocks, math formulas, or inline code are safely ignored.
* **Non-Destructive Surgical ID Injection:** Injects tracking IDs (`<!--anki-id: uuid-->`) by calculating exact byte offsets on the raw file buffer. Never re-serializes your Markdown through a formatter, preserving your formatting, whitespace, and custom syntax 100%.
* **Live Preview & Sync Parity:** Real-time CodeMirror 6 editor decorations show card boundaries, card types, and sync status badges. Preview errors hard-block Anki writes so you never get broken cards in Anki.
* **Deep Transclusion Resolution:** Automatically expands Obsidian block embeds (`![[Note#^block-id]]`) into flashcard fields prior to compile.
* **Local Media Syncing:** Detects images, PDFs, audio, and SVGs, converting them to Base64 payloads and uploading them to Anki via AnkiConnect.
* **Stock & Custom Card Types:** Supports stock Anki models:
  * **Basic** (`:::`)
  * **Reversible** (`:::r`)
  * **Typed** (`:::t`)
  * **Cloze** (`{{c1::...}}` or `#anki/cardType/cloze`)
* **Duplicate Detection:** Scans your entire vault to warn against front collisions and answer mismatches.

---

## 📦 Prerequisites

1. **Anki Desktop** running locally.
2. **AnkiConnect** add-on installed in Anki (Add-on code: `2055492159`).
3. **AnkiConnect CORS Setup**:
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
   *(Restart Anki after modifying this configuration).*

---

## 🚀 Quick Start

1. Enable **Anki AST Sync** in Obsidian under **Settings → Community plugins**.
2. Create a note and enable synchronization by adding `AnkiSync: on` to your frontmatter:
   ```markdown
   ---
   AnkiSync: on
   target_anki_deck: Spanish
   ---

   #### What is the capital of France?
   :::
   Paris
   ```
3. Run the command **Anki AST Sync: Sync current note to Anki** (or click the ribbon icon to sync your entire vault).

---

## ⌨️ Useful Commands

* **Check AnkiConnect connection** — verifies Anki is reachable.
* **Sync vault to Anki** — syncs all eligible vault notes to Anki with media and ID injection.
* **Dry-run sync vault to Anki** — simulates sync and displays intended actions without modifying files or Anki.
* **Sync current note to Anki** — fast, single-file sync for the active note.
* **Create new Anki note** — creates a note pre-populated with `AnkiSync: on` and a starter card.
* **Toggle Anki sync for current note** — quickly toggles `AnkiSync: on / off`.
* **Set target Anki deck for current note** — select an Anki deck via fuzzy search.
* **Insert card template...** — modal picker for Basic, Reversible, Typed, and Cloze skeletons.
* **Wrap selection as cloze deletion** — wraps selected text in `{{c1::...}}` with intelligent index incrementing.
* **Jump to next / previous card in note** — rapid navigation between card headings.
* **Open current card in Anki Desktop** — locates and displays the active card in Anki's card browser.

---

## 🛠 Development & Building

This plugin is part of the [Obsidian-Anki-AST-Engine](https://github.com/zunaidFarouque/Obsidian-Anki-AST-Engine) repository.

```bash
# Clone the repository
git clone https://github.com/zunaidFarouque/Obsidian-Anki-AST-Engine.git
cd Obsidian-Anki-AST-Engine

# Install dependencies (requires bun)
bun install
cd plugin && bun install

# Build the plugin
bun run build:plugin

# Run tests
bun test
```

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
