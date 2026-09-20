# Obsidian Plugin: Authoring & Navigation Helper Commands

This document covers the authoring, templating, and navigation helper commands added in the Obsidian community plugin (`plugin/`). These commands eliminate the manual friction of setting up YAML frontmatter, remembering card syntax delimiters, wrapping clozes, and jumping between cards.

---

## 1. Overview of Commands

All commands are available in the Obsidian Command Palette (`Ctrl+P` / `Cmd+P`):

### 📁 Note Lifecycle & Frontmatter

| Command Name | Command ID | Description |
| :--- | :--- | :--- |
| **Create new Anki note** | `create-new-anki-note` | Creates a new Markdown file with valid `AnkiSync: on` frontmatter (and optional target deck), inserts a starter card, and positions the cursor ready to write. |
| **Toggle Anki sync for current note** | `toggle-anki-sync-current-note` | Safely sets or toggles `AnkiSync: on` / `off` in the active note's YAML frontmatter using Obsidian's atomic frontmatter processor. |
| **Set target Anki deck for current note** | `set-target-deck-current-note` | Opens a fuzzy search modal populated with your Anki decks (via AnkiConnect) to update `target_anki_deck` in the active note. |

---

### 🗂️ Card Skeletons & Templates

Each template respects the active note's frontmatter heading level (`cardDeclarationHeadingLevel`) and delimiter (`delimiter`), with automatic fallbacks to your plugin settings.

| Command Name | Command ID | Generated Syntax |
| :--- | :--- | :--- |
| **Insert card template...** | `insert-card-template-picker` | Opens a fuzzy picker modal listing all built-in card types (Basic, Reversible, Typed, Cloze) plus custom Anki note types fetched from Anki. |
| **Insert basic card at cursor** | `insert-card-basic` | Inserts `#### Card Title\nFront text\n:::\nBack text\n` (pre-selects "Card Title" for immediate typing). |
| **Insert reversible card at cursor** | `insert-card-reversible` | Inserts `#### Term\nFront\n:::r\nBack\n`. |
| **Insert typed card at cursor** | `insert-card-typed` | Inserts `#### Prompt\nQuestion\n:::t\nAnswer\n`. |
| **Insert cloze card at cursor** | `insert-card-cloze` | Inserts `#### Cloze Note\nThe {{c1::cloze deletion}} goes here.\n:::\nOptional back extra\n`. |

> [!TIP]
> **Selection-Aware:** If you highlight text before running an insert command:
> - **Basic / Reversible / Typed:** The selected text is embedded directly as the Front / Question.
> - **Cloze:** The selected text is automatically wrapped in `{{c1::...}}`.

---

### ✍️ In-Editor Authoring Shortcuts

| Command Name | Command ID | Description |
| :--- | :--- | :--- |
| **Wrap selection as cloze deletion** | `wrap-selection-cloze` | Wraps the selected text with `{{cN::...}}`. Scans the current card boundary for existing clozes and automatically increments `c1` → `c2` → `c3`. If nothing is selected, inserts `{{cN::}}` with the cursor placed inside. |

---

### 🧭 Navigation & Troubleshooting

| Command Name | Command ID | Description |
| :--- | :--- | :--- |
| **Jump to next card in note** | `jump-to-next-card` | Moves the editor cursor to the next card declaration heading (loops around at EOF). |
| **Jump to previous card in note** | `jump-to-previous-card` | Moves the editor cursor to the previous card declaration heading (loops around at top). |
| **Jump to next card with sync issue** | `jump-to-next-problem-card` | Runs the deterministic AST parser on the current note, finds cards flagged as `skip`, `warn`, or `error`, moves the cursor directly to the heading, and displays the exact reason in a notice. |
| **Open current card in Anki Desktop** | `open-card-in-anki` | Reads the card enclosing the cursor, extracts its `<!--anki-id: ...-->`, and commands Anki Desktop (`guiBrowse`) to highlight and open the card in the Anki Card Browser. |

---

## 2. Configuration Settings

Open **Obsidian Settings → Community plugins → Obsidian Anki AST Sync** to configure authoring behaviors:

| Setting | Default | Description |
| :--- | :--- | :--- |
| **New note folder** | `""` (Obsidian default) | Specific vault folder where new notes created via `Create new Anki note` are placed (e.g. `Cards` or `Notes/Study`). |
| **Insert starter card in new notes** | `true` | When enabled, new notes are initialized with frontmatter *and* an initial basic card template. |
| **New note default deck** | `""` (inherit default) | Override the default Anki deck specifically for newly created notes. |
| **Auto-increment cloze index** | `true` | When wrapping selections with the cloze command, detects existing `{{c1::...}}` clozes in the current card and assigns the next index (`c2`, `c3`, etc.). |
| **Use shorthand cloze format** | `false` | When enabled, generates shorthand `{{...}}` clozes instead of standard `{{c1::...}}` clozes. |

---

## 3. Recommended Hotkey Setup

For optimal muscle memory, configure these hotkeys in **Obsidian Settings → Hotkeys**:

* `Ctrl+Shift+C` (or `Cmd+Shift+C` on macOS): **Wrap selection as cloze deletion** *(Standard Anki hotkey)*
* `Alt+N`: **Create new Anki note**
* `Alt+C`: **Insert card template...** (opens fuzzy picker)
* `Alt+Down`: **Jump to next card in note**
* `Alt+Up`: **Jump to previous card in note**
* `Alt+Shift+Down`: **Jump to next card with sync issue (warning/error)**
* `Alt+O`: **Open current card in Anki Desktop**

---

## 4. Custom Note Type Skeletons

If you have custom note types in Anki (e.g. a Vocabulary note with fields `Word`, `Reading`, `Meaning`, `Audio`), the plugin can auto-scaffold cards for them:

1. Press `Ctrl+P` → **Insert card template...**
2. Choose your custom note type from the list (e.g. `Custom: Japanese-Vocab`).
3. The command will automatically insert:
   ```markdown
   #### Japanese-Vocab Item #anki/noteType/Japanese-Vocab
   ::: Word
   
   ::: Reading
   
   ::: Meaning
   
   ::: Audio
   
   ```
4. The title placeholder is selected so you can start typing immediately without manually creating field delimiter blocks.

---

## 5. Technical Design & TDD Guarantee

All underlying string operations, frontmatter parsers, auto-incrementing state machines, and card boundary detectors are implemented as pure, zero-DOM TypeScript functions in:
- `plugin/src/helpers/noteHelperUtils.ts`
- `plugin/src/helpers/cardTemplateUtils.ts`
- `plugin/src/navigation/cardNavigationUtils.ts`

These utilities are strictly covered by automated unit tests running in Bun:
- `tests/plugin/noteHelperUtils.test.ts`
- `tests/plugin/cardTemplateUtils.test.ts`
- `tests/plugin/cardNavigationUtils.test.ts`

To run the test suite:
```bash
bun test
```
