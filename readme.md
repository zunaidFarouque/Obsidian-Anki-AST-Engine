# Anki AST Sync 🧠⚡️

A deterministic, AST-powered synchronization pipeline and Obsidian plugin bridging **Obsidian** and **Anki**.

Traditional sync tools rely on fragile Regular Expressions (Regex) that break when confronted with modern Markdown complexities like nested code blocks, escaped characters, LaTeX math, HTML tables, or block transclusions (`![[SourceNote#^block-id]]`).

**Anki AST Sync** solves this by transforming your Obsidian vault notes into a traversable **Abstract Syntax Tree (AST)** via the `unified` / `remark` ecosystem. By understanding the semantic structure of your notes, it achieves flawless, non-destructive synchronization with Anki while keeping your Markdown files pristine.

---

## ✨ Core Features

* **Deterministic AST Parsing:** Structural delimiters inside code blocks, math formulas, or inline code are safely ignored.
* **Non-Destructive Surgical ID Injection:** Generates and tracks unique UUIDs via HTML comments (`<!--anki-id: uuid-->`). IDs are injected by splicing the raw file buffer at AST-derived byte offsets—never by round-tripping Markdown through a serializer, preserving 100% of your vault's original formatting and whitespace.
* **Live Preview & Sync Parity:** Real-time CodeMirror 6 editor decorations display card envelopes, card types, and sync status badges. Preview errors hard-block Anki writes so you never get broken cards in Anki.
* **Deep Transclusion Resolution:** Native support for Obsidian block embeds (`![[SourceNote#^block-id]]`). The engine recursively fetches, parses, and grafts transcluded content directly into your flashcards prior to sync.
* **Local Media Syncing:** Automatically detects embedded images, audio, video, and PDFs, converting them to Base64 payloads and uploading them to Anki via AnkiConnect.
* **Stock & Custom Card Types:** Supports stock Anki models out of the box:
  * **Basic** (`:::`)
  * **Reversible** (`:::r`)
  * **Typed** (`:::t`)
  * **Cloze** (`{{c1::...}}` or `#anki/cardType/cloze`)
* **Duplicate Detection:** Scans your entire vault to detect duplicate fronts and answer mismatches before writing to Anki.
* **Stateless Concurrency Control:** Throttles AnkiConnect HTTP requests with `p-limit` and automatic retries so large vault syncs never overwhelm the local Anki instance.

---

## 📦 Prerequisites

1. **Anki Desktop** running locally (required for live sync).
2. **AnkiConnect** add-on installed in Anki (Add-on code: `2055492159`).
3. **AnkiConnect CORS Setup**:
   In Anki Desktop, navigate to **Tools → Add-ons → AnkiConnect → Config** and ensure your `webCorsOriginList` includes Obsidian:
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
   *(Restart Anki after editing this configuration).*

---

## 🚀 Obsidian Plugin Quick Start

### 1. Installation

- **Community Plugins:** Search for **Anki AST Sync** in Obsidian under **Settings → Community plugins → Browse** and click **Install** then **Enable**.
- **Manual / BRAT:** You can also install beta releases using the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) with repository `zunaidFarouque/Obsidian-Anki-AST-Engine`.

### 2. Enable Sync on a Note

Add `AnkiSync: on` to your note's YAML frontmatter:

```markdown
---
AnkiSync: on
target_anki_deck: Computer Science
---

#### What is the time complexity of binary search?
:::
O(log n)
```

### 3. Supported Card Syntax

#### Basic Card
```markdown
#### What is the primary function of mitochondria?
:::
ATP production via cellular respiration.
```

#### Reversible Card
```markdown
#### Bonjour :::r Hello
```

#### Typed Card
```markdown
#### What command lists directory contents in Linux?
:::t
ls
```

#### Cloze Deletion Card
```markdown
#### Photosynthesis
:::
In plants, {{c1::chlorophyll}} absorbs light energy to convert {{c2::carbon dioxide}} and water into glucose.
```

### 4. Running a Sync

- Click the ribbon icon (⚡ / ⭐) on the left sidebar.
- Open the Command Palette (`Ctrl/Cmd + P`) and run **Anki AST Sync: Sync active note** or **Anki AST Sync: Sync entire vault**.

---

## 💻 Headless CLI & Engine Usage

For headless automation, CI/CD pipelines, or standalone terminal usage:

```bash
git clone https://github.com/zunaidFarouque/Obsidian-Anki-AST-Engine.git
cd Obsidian-Anki-AST-Engine
bun install
bun run build
```

Copy `config.json.example` to `config.json` and set your vault path:

```bash
# Dry run (parses AST and outputs planned actions without touching Anki or files)
bun run sync -- --dry-run

# Live synchronization
bun run sync

# Connectivity check
bun run sync -- --check
```

---

## 🧪 Test-Driven Development (TDD)

This project strictly adheres to TDD to handle edge cases across personal knowledge management workflows.

```bash
bun test
```

Currently passing **800+ test cases** across AST parsing, cloze extraction, transclusion resolution, media encoding, and CodeMirror Live Preview editor decorations.

---

## 🤝 Contributing

Contributions are welcome! Please ensure you have read the architectural docs in the `Docs/` directory ([Engine-Architecture.md](Docs/Engine-Architecture.md), [Anki-Integration.md](Docs/Anki-Integration.md), [Obsidian-Parity.md](Docs/Obsidian-Parity.md), and [Sync-Performance-Roadmap.md](Docs/Sync-Performance-Roadmap.md)). All parsing modifications must include an accompanying fixture test in `tests/`.

## 📄 License

MIT
