# Anki AST Sync 🧠⚡️

[![Tests](https://img.shields.io/badge/tests-800%2B%20passing-brightgreen.svg)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Obsidian Community Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple.svg)](plugin/)
[![Bun Runtime](https://img.shields.io/badge/Bun-v1.2%2B-black.svg)](https://bun.sh)

A deterministic, AST-powered synchronization pipeline and Obsidian plugin bridging **Obsidian** and **Anki**.

Traditional flashcard sync tools rely on fragile Regular Expressions (Regex) that break when confronted with modern Markdown complexities like nested code blocks, escaped characters, LaTeX math formulas, Obsidian callouts, HTML tables, or block transclusions (`![[SourceNote#^block-id]]`). Worse, many tools re-serialize your entire Markdown file through formatters, destroying your custom formatting, spacing, and personal styling.

**Anki AST Sync** solves this by parsing your Obsidian notes into an **Abstract Syntax Tree (AST)** via the unified / remark engine. It understands the true syntactic structure of your notes, ensuring safe, non-destructive synchronization with Anki while keeping your Markdown files pristine.

---

## 📑 Table of Contents

- [✨ Core Features](#-core-features)
- [🏗 Architecture & How It Works](#-architecture--how-it-works)
- [📦 Prerequisites & Setup](#-prerequisites--setup)
- [🚀 Quick Start](#-quick-start)
- [📝 Card Syntax Reference](#-card-syntax-reference)
  - [Syntax Fundamentals](#syntax-fundamentals)
  - [1. Basic Cards](#1-basic-cards-basic)
  - [2. Reversible Cards](#2-reversible-cards-reversible)
  - [3. Typed Answer Cards](#3-typed-answer-cards-typed)
  - [4. Cloze Deletions](#4-cloze-deletions-cloze)
  - [5. Custom Anki Note Models](#5-custom-anki-note-models-custom)
  - [6. Section Inheritance & Outline Isolation](#6-section-inheritance--outline-tree-isolation)
  - [7. Reserved Hashtags vs User Tags](#7-reserved-hashtags-vs-user-tags)
  - [8. Media & Attachments](#8-media--attachments)
  - [9. Block Transclusions & Embeds](#9-block-transclusions--embeds)
- [⚙️ Frontmatter Configuration](#️-frontmatter-configuration)
- [👁 Live Preview & Diagnostic Badges](#-live-preview--diagnostic-badges)
- [⌨️ Available Commands](#️-available-commands)
- [🛡 Safe Orphan & Duplicate Management](#-safe-orphan--duplicate-management)
- [⚙️ Settings Guide](#️-settings-guide)
- [💻 Headless CLI & Automation](#-headless-cli--automation)
- [❓ Troubleshooting & FAQ](#-troubleshooting--faq)
- [🛠 Development & Testing](#-development--testing)
- [📄 License](#-license)

---

## ✨ Core Features

* **Deterministic AST Parsing:** Structural delimiters inside fenced code blocks, inline code, or math formulas (`$...$`, `$$...$$`) are safely ignored.
* **Non-Destructive Surgical ID Injection:** Generates unique tracking UUIDs (`&lt;!--anki-id: uuid--&gt;`) by calculating exact byte offsets on raw file buffers. It **never** round-trips Markdown through a serializer, preserving 100% of your vault's original indentation, line endings, and custom syntax.
* **Live Preview & Sync Parity:** Real-time CodeMirror 6 editor decorations display card envelopes, resolved types, and sync status badges (`SYNC`, `WARN`, `SKIP`, `ERROR`). The preview parser and the sync engine share the exact same underlying logic.
* **Write Hard-Gating:** Preview errors (`error` and `skip`) hard-block writes to Anki so malformed cards will never corrupt your Anki collection.
* **Deep Transclusion Resolution:** Seamlessly expands Obsidian block embeds (`![[SourceNote#^block-id]]`). The engine recursively fetches, parses, and grafts transcluded content directly into your flashcards prior to sync.
* **Local Media Syncing:** Automatically detects embedded images, audio, video, and PDFs, encoding them and uploading them to Anki's media folder via AnkiConnect.
* **Stock & Custom Card Types:** Supports stock Anki note models out of the box (Basic, Reversible, Typed, Cloze) and user-defined custom note types (`#anki/noteType/YourModel`).
* **Vault-Wide Duplicate Detection:** Scans your vault to catch duplicate fronts and answer collisions before any card is written to Anki.
* **Interactive Diagnostics:** Click any Live Preview status badge to inspect the parsed AST fields, inherited tags, and exact validation messages.

---

## 🏗 Architecture & How It Works

```mermaid
flowchart TD
    subgraph Obsidian ["Obsidian Vault"]
        Note["Markdown Note (.md)"]
        FrontFilter{"AnkiSync: on?"}
        SourceAST["Source AST (remark/unified)"]
        SourceOffsets["Extract Card Bounds & Injection Offsets"]
    end

    subgraph Engine ["AST Sync Engine"]
        TransGraft["Graft Transclusions (![[note#^block]])"]
        MediaRes["Resolve Media & Queue Uploads"]
        GraftedAST["Grafted AST & HTML Compiler"]
        DocResolve["parseCardDocument (Resolve Card Types)"]
        Gate{"Sync Eligibility Gate"}
    end

    subgraph Anki ["Anki Desktop"]
        DupCheck["Vault Duplicate Preflight"]
        AnkiConnect["AnkiConnect HTTP Bridge (Port 8765)"]
        Collection[("Anki Collection")]
    end

    subgraph WriteBack ["Vault Safe Write-Back"]
        SurgicalInject["Surgical Buffer Splice [anki-id: uuid comment]"]
    end

    Note --> FrontFilter
    FrontFilter -->|Yes| SourceAST
    FrontFilter -->|No| Ignored["Skipped"]
    SourceAST --> SourceOffsets
    SourceAST --> TransGraft
    TransGraft --> MediaRes
    MediaRes --> GraftedAST
    GraftedAST --> DocResolve
    DocResolve --> Gate
    Gate -->|Error / Skip| Blocked["Hard Blocked (No Anki Write)"]
    Gate -->|Sync / Warn| DupCheck
    DupCheck --> AnkiConnect
    AnkiConnect --> Collection
    Collection -->|Return Note IDs| SurgicalInject
    SourceOffsets -.->|Byte Offsets| SurgicalInject
    SurgicalInject --> Note
```

### Why AST Parsing Matters
1. **Never Re-formats Your Notes:** Unlike other sync tools that parse Markdown into a data model and then regenerate Markdown (destroying your personal formatting), Anki AST Sync reads the AST as a read-only spatial map to compute byte indices. The only write operation performed on your note is splicing a tiny HTML comment (`&lt;!--anki-id: uuid--&gt;`) right at the calculated offset at the end of the card.
2. **Context-Aware Delimiters:** If you write `:::` or `---` inside a Python code block or a LaTeX matrix, regex-based tools break. An AST parser knows that node belongs to `code` or `math` and ignores it completely.

---

## 📦 Prerequisites & Setup

### 1. Requirements
* **Obsidian Desktop** (v1.4.0 or newer).
* **Anki Desktop** (v2.1.54 or newer) running locally during sync.
* **AnkiConnect Add-on** installed in Anki Desktop (Code: `2055492159`).

### 2. Configure AnkiConnect (CORS)
In Anki Desktop, open **Tools → Add-ons → AnkiConnect → Config** and ensure your `webCorsOriginList` includes Obsidian:

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

> [!IMPORTANT]
> **Restart Anki Desktop** after editing this configuration to apply the new settings.
> You can verify AnkiConnect is running by visiting `http://127.0.0.1:8765` in any browser (it should display `"AnkiConnect"`).

### 3. Install the Obsidian Plugin
* **Community Plugins (Recommended):** Search for **Anki AST Sync** under **Settings → Community plugins → Browse** and click **Install**, then **Enable**.
* **Via BRAT:** Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat), select **Add Beta plugin**, and enter `zunaidFarouque/Obsidian-Anki-AST-Engine`.

---

## 🚀 Quick Start

### Step 1: Enable Sync on a Note
Add `AnkiSync: on` to your note frontmatter. You can optionally set a target deck and tags:

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

### Step 2: Trigger Synchronization
You have several convenient ways to sync:
- **Ribbon Icon:** Click the star/lightning icon (⚡) on Obsidian's left ribbon to sync your vault.
- **Command Palette (`Ctrl/Cmd + P`):**
  - Run **Anki AST sync: Sync current note to Anki** for instant single-file sync.
  - Run **Anki AST sync: Sync vault to Anki** for full-vault sync.
  - Run **Anki AST sync: Dry-run sync current note to Anki** to preview changes without modifying anything.

---

## 📝 Card Syntax Reference

### Syntax Fundamentals
* **Card Heading Boundary:** Each flashcard begins at a heading level matching your configured level (default: `####` level 4) and continues until the next heading of equal or shallower depth.
* **Line-Start Delimiters:** Structural delimiters (`:::`, `:::r`, `:::t`, `::: FieldName`) **must be placed on their own line** (at line-start). Delimiters cannot be placed inline in the middle of a line or inside headings.
* **Code & Math Protection:** Delimiters inside code fences, inline code, or LaTeX math blocks (`$...$`, `$$...$$`) are ignored by the AST parser.

---

### 1. Basic Cards (`basic`)
Maps to Anki's standard **Basic** model (Fields: `Front`, `Back`). Requires a line-start `:::` delimiter.

#### Standard Question and Answer (Body Front)
Write your question in the card body before the delimiter, and the answer after it:
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

#### Bare Mustache & Cloze Handling
* **Bare `{{word}}`:** On a basic card, bare `{{word}}` emits a warning and stays literal text.
* **Manual Cloze `{{c1::...}}` on Basic:** By default, stays literal with a warning, unless the setting `inferClozeFromManualSyntaxOnBasic` is enabled.

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

#### Multiple Acceptable Answers
Separate alternative acceptable answers on the answer line with pipes (`|`):
```markdown
#### Capital of France
Name a major city in France:
:::t
Paris | Lyon | Marseille
```

#### Important Rules for Typed Cards
* **Single-line answer:** Only the first non-empty line of the Back region is tested. Subsequent lines are ignored and trigger a warning.
* **Plain text:** Markdown/HTML formatting (bold, italics, links) is stripped; formatting triggers a warning badge.

---

### 4. Cloze Deletions (`cloze`)
Maps to Anki's **Cloze** model (Fields: `Text`, `Back Extra`).

> [!IMPORTANT]
> **Cloze deletions MUST be in the Text region** (before `:::`, or the whole card body if no `:::` is present).
> **Never put `:::` before the cloze text** — that places the deletions in the Back Extra field and triggers a fatal error!

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

#### Shorthand Cloze & Auto-Numbering
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

* **Field Delimiters:** Each field starts with `::: FieldName` at line-start, followed by exactly one space, then the field name matching your Anki model (case-insensitive).
* **Order Independent:** Fields can appear in any order.
* **Typo Protection:** If a field name does not match the Anki model, an error is surfaced showing valid field names.
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

* **Card Heading Wins:** A type tag on a card heading overrides any inherited section type.
* **Nearest Ancestor Wins:** Nested sections inherit from the closest ancestor with a type tag.
* **Sibling Isolation:** Sibling sections do not inherit tags from adjacent sections.

---

### 7. Reserved Hashtags vs User Tags
* **Engine Directives:** Hashtags starting with `#anki/` (e.g. `#anki/cardType/cloze`, `#anki/noteType/Vocab`) or `#anki_card_*` are engine directives. They are used for type resolution and are **never** synced to Anki as tags.
* **User Tags:** Any other hashtags on headings (e.g. `#biology`, `#exam-2026`) ARE synced to Anki as tags.
* **Hierarchical Tags:** When `includeParentHeadersAsTags` is enabled, heading titles in the ancestor chain are concatenated into hierarchical tags (e.g. `Biology::Genetics`).

---

### 8. Media & Attachments
Embed media using standard Markdown or Obsidian wikilinks:

```markdown
#### Anatomy of the Heart
:::
![[heart-diagram.png]]
The left ventricle pumps oxygenated blood through the aortic valve.
```
The engine resolves the file from your vault or attachment folder, generates a Base64 payload, and uploads it safely to Anki's media storage via AnkiConnect.

---

### 9. Block Transclusions & Embeds
Seamlessly reuse content from other vault notes without duplication:

```markdown
#### Proof of the Pythagorean Theorem
:::
![[Math Theorems#^pythagoras-proof]]
```
During synchronization, the engine dereferences the block embed, pulls the transcluded AST subtree into the card, and uploads the expanded HTML to Anki.

---

## ⚙️ Frontmatter Configuration

Configure synchronization behavior per file using YAML frontmatter properties:

| Frontmatter Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `AnkiSync` | `boolean` / `string` | `off` | Set to `on` or `true` to enable sync for the note. |
| `target_anki_deck` | `string` | Settings default | Overrides the target Anki deck for all cards in this note. |
| `file_anki_tags` | `string` | `""` | Comma-separated extra tags applied to all cards in this note. |
| `cardDeclarationHeadingLevel` | `number (1–6)` | `4` | Heading level defining card envelopes for this note (default: `4` for `####`). |
| `delimiter` | `string` | `:::` | Overrides front/back separator for this note. |
| `includeParentHeadersAsTags` | `boolean` | `true` | Toggles hierarchical tags from ancestor headings. |
| `anki_cardDefault` | `string` | `basic` | Default built-in card type (`basic`, `cloze`, `reversible`, `typed`). |
| `anki_customCardDefault` | `string` | — | Default custom note type (e.g. `Vocab`) when using `::: FieldName` blocks. |
| `anki_customLayoutMap` | `object` / `string` | — | Custom field mapping for remapping fields. |

---

## 👁 Live Preview & Diagnostic Badges

When **Live card preview** is enabled in Settings, the CodeMirror 6 editor renders interactive visual indicators directly beside card headings:

* 🟢 **SYNC**: The card syntax is valid and ready to be synchronized to Anki.
* 🟡 **WARN**: The card will sync, but has potential formatting issues (e.g. formatting inside a typed answer, bare mustache on basic card).
* ⚪ **SKIP**: The card will be skipped (e.g. basic card missing `:::`, cloze card with no deletions in Text, duplicate front in vault).
* 🔴 **ERROR**: Structural error (e.g. cloze with `:::r`, cloze deletions only in Back Extra, conflicting tags). **Writes to Anki are hard-blocked** to prevent corrupting your collection.

### Interactive Card Inspector
Click any badge in the editor to open the **Card Preview Inspector Modal**:
- View the exact resolved Anki model (e.g. `Basic`, `Cloze`, `Custom`).
- Inspect compiled HTML fields for Front, Back, or custom field names.
- See inherited parent tags and inline hashtags.
- Read actionable diagnostic messages.

---

## ⌨️ Available Commands

Access these anytime via the Command Palette (`Ctrl/Cmd + P`):

| Command | Action |
| :--- | :--- |
| **Sync current note to Anki** | Synchronizes flashcards in the active note to Anki. |
| **Sync vault to Anki** | Scans all configured vault folders and syncs all eligible notes. |
| **Dry-run sync current note to Anki** | Simulates sync for the active note without modifying files or Anki. |
| **Dry-run sync vault to Anki** | Simulates full vault sync and displays intended actions in a results dialog. |
| **Check AnkiConnect connection** | Pings AnkiConnect and reports the API version or connection error. |
| **Create new Anki note** | Creates a new note pre-configured with `AnkiSync: on` and a starter card. |
| **Toggle Anki sync for current note** | Toggles `AnkiSync: on` / `off` in the active note's frontmatter. |
| **Set target Anki deck for current note** | Fuzzy-search your Anki decks to set `target_anki_deck`. |
| **Insert card template...** | Modal picker to insert Basic, Reversible, Typed, or Cloze card templates. |
| **Wrap selection as cloze deletion** | Wraps selected text in `{{c1::...}}` with intelligent auto-incrementing. |
| **Jump to next / previous card in note** | Fast navigation between card headings in long notes. |
| **Jump to next card with sync issue** | Jumps directly to the next card with a warning or error badge. |
| **Open current card in Anki desktop** | Locates and displays the active card inside Anki's Card Browser. |

---

## 🛡 Safe Orphan & Duplicate Management

### Vault Duplicate Detection
Before writing cards to Anki, the engine performs a preflight duplicate check across your vault. If two cards have identical deck targets and front content, a collision warning is surfaced, preventing accidental duplicate creation.

### Orphan Card Detection
When notes or cards are deleted from Obsidian, their corresponding Anki notes become "orphans". During full-vault sync, Anki AST Sync detects orphaned cards and prompts you with safe resolution choices:
- **Ignore:** Leaves the note in Anki and tags it with `obsidian-sync-ignore` so you are never prompted again.
- **Suspend:** Hides the card from daily review in Anki without deleting review history.
- **Delete:** Permanently removes the orphaned note from Anki.
- **Cancel:** Aborts the sync run safely.

---

## ⚙️ Settings Guide

Open **Settings → Anki AST Sync** in Obsidian to customize:

1. **AnkiConnect Connection:**
   - **AnkiConnect URL:** Endpoint address (default: `http://127.0.0.1:8765`).
   - **AnkiConnect API key:** Optional security key matching your AnkiConnect config.
   - **Test connection:** Interactive one-click connection test with live status indicator.
2. **Vault and Sync Scope:**
   - **Scan folders:** Comma-separated list of folders (leave empty to scan entire vault).
   - **Default Anki deck:** Fallback deck when `target_anki_deck` is not specified.
   - **Auto-create missing decks:** Automatically creates target decks in Anki during sync.
   - **Auto-create stock note types:** Ensures Basic, Cloze, Reversible, and Typed models exist in Anki.
   - **Default engine tag:** Global tag applied to all synced notes (default: `Obsidian-Anki-AST`).
3. **Card Syntax and Parsing:**
   - **Default card heading level:** Slider from H1 to H6 (default: `4` for `####`).
   - **Card delimiter:** Separator string (default: `:::`).
   - **Infer cloze on basic cards:** Automatically reclassifies basic cards containing cloze syntax as cloze.
   - **Include parent headers as tags:** Converts heading paths into hierarchical tags.
   - **Wikilink format:** How note links are resolved (`Shortest`, `Relative`, `Absolute`).
   - **Attachment folder:** Custom folder for media resolution.
4. **Live Editor Preview:**
   - **Live card preview:** Toggle real-time Live Preview editor decorations.
   - **Card heading line style:** Visual emphasis on card heading (`Off`, `Shaded`, `Shaded with divider`).
   - **Section top background extend:** Vertical tint extension above headings.
   - **Gap between card blocks:** Spacing between adjacent card backgrounds.
   - **Refresh note types cache:** Fetches current Anki model fields to validate custom cards.
5. **Note Creation and Authoring Helpers:**
   - **New note folder:** Target directory for the "Create new Anki note" command.
   - **New note default deck:** Default deck prefilled in newly created notes.
   - **Insert starter card in new notes:** Automatically populates starter templates.
   - **Auto-increment cloze index:** Increments cloze numbers (`c1`, `c2`, `c3`) automatically.
   - **Use shorthand cloze format:** Generates `{{...}}` shorthand by default.
6. **Orphan Notes and Safety:**
   - **Orphan note handling:** Prompt for orphans on full-vault sync (`Ask each sync` or `Off`).
   - **Allow suspend for orphan notes:** Enables the Suspend action in the orphan dialog.
   - **Orphan ignore tag:** Tag applied to ignored orphan notes.

---

## 💻 Headless CLI & Automation

For headless terminal sync, CI/CD pipelines, or automated scripts, the underlying engine can run directly via **Bun**:

```bash
git clone https://github.com/zunaidFarouque/Obsidian-Anki-AST-Engine.git
cd Obsidian-Anki-AST-Engine
bun install
bun run build
```

Copy `config.json.example` to `config.json`:
```json
{
  "vaultPath": "/path/to/your/obsidian/vault",
  "scanFolders": ["Notes", "Flashcards"],
  "defaultAnkiDeck": "Synced from Obsidian",
  "defaultEngineTag": "Obsidian-Anki-AST",
  "ankiConnectUrl": "http://127.0.0.1:8765",
  "delimiter": ":::",
  "defaultCardDeclarationHeadingLevel": 4,
  "autoCreateDecks": true,
  "autoCreateStockNoteModels": true,
  "inferClozeFromManualSyntaxOnBasic": true
}
```

Run CLI commands:
```bash
# Verify AnkiConnect connectivity
bun run sync -- --check

# Dry-run sync (safe simulation)
bun run sync -- --dry-run

# Live synchronization
bun run sync
```

---

## ❓ Troubleshooting & FAQ

### AnkiConnect connection failed
* **Is Anki Desktop running?** Anki must be open in the background.
* **Is AnkiConnect installed?** Verify the add-on is installed (Code: `2055492159`).
* **Check CORS configuration:** Ensure `app://obsidian.md` and `http://localhost` are in `webCorsOriginList` under **Tools → Add-ons → AnkiConnect → Config**, then restart Anki.
* **Use the in-app diagnostic:** Open **Settings → Anki AST Sync** and click **Test connection** to see the exact error message.

### Why was my card not synced?
* Verify the note's frontmatter has `AnkiSync: on`.
* Ensure the heading level matches your configured setting (default is `####` level 4).
* Check the Live Preview badge on the card heading in Obsidian. If it shows 🔴 **ERROR**, click the badge to inspect the exact syntax issue.

### Does this plugin modify my Markdown files?
Only in one minimal, non-destructive way: when a card is first synchronized to Anki, the plugin splices a small tracking comment (`&lt;!--anki-id: uuid--&gt;`) directly at the end of the card content. It never touches your headings, and never reformats, re-indents, or rewrites your Markdown.

---

## 🛠 Development & Testing

We maintain a strict Test-Driven Development (TDD) culture with **800+ test cases** covering AST parsing, cloze extraction, transclusions, media resolution, duplicate detection, and editor decorations.

```bash
# Run the complete test suite
bun test

# Run tests in watch mode
bun test --watch

# Build the Obsidian plugin and dist bundle
bun run build

# Run linter
bun run lint
```

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.
