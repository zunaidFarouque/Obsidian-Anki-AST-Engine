# **Obsidian-Anki AST Engine 🧠⚡️**

A deterministic, headless Node.js synchronization pipeline bridging Obsidian and Anki.

Traditional sync tools rely on fragile Regular Expressions (Regex) that break when confronted with modern Markdown complexities like nested code blocks, escaped characters, and deeply linked block transclusions.

This engine solves that by transforming your Obsidian vault into a traversable **Abstract Syntax Tree (AST)**. By understanding the semantic structure of your notes, it achieves flawless, non-destructive, two-way synchronization with Anki.

## **✨ Core Features**

* **Deterministic AST Parsing:** Powered by the unified and remark ecosystem. Parses flashcard layouts structurally, completely ignoring delimiters hidden inside code, inlineCode, or math blocks.  
* **Deep Transclusion Resolution:** Native support for Obsidian block embeds (\!\[\[SourceNote\#^block-id\]\]). The engine recursively fetches, parses, and grafts transcluded content directly into your flashcards before syncing.  
* **Local Media Syncing:** Automatically detects embedded media (\!\[\[image.png\]\]), converts files to Base64 payloads, and queues them for injection via AnkiConnect.  
* **Surgical Two-Way Binding:** Generates and tracks unique UUIDs via HTML comments (\<\!--anki-id: uuid--\>). IDs are injected by splicing the raw file at AST-derived byte offsets—never by round-tripping Markdown through a serializer. Pre-graft offsets are preserved when transclusions expand card content for HTML compile. See [Docs/Engine-Architecture.md](Docs/Engine-Architecture.md#read-only-ast-and-vault-safety).
* **Duplicate detection:** Flags vault cards that compile to the same Front HTML (and `back_mismatch` when answers differ). Warnings are emitted on stderr as JSON for future in-editor notifications. See [Docs/Anki-Integration.md](Docs/Anki-Integration.md#duplicate-detection).
* **Stable Anki updates:** Normalizes line endings inside compiled code blocks before comparing to Anki, so Windows CRLF does not cause false `update` actions.
* **Stateless Concurrency Control:** Throttles AnkiConnect HTTP (media uploads, batched card sync) with `p-limit` and automatic retry so large vault syncs do not overwhelm the local Anki server. See [Docs/Sync-Performance-Roadmap.md](Docs/Sync-Performance-Roadmap.md).

## **🚀 Architecture Overview**

The system operates strictly headlessly, reading from an absolute vault path and talking to a local AnkiConnect instance.

1. **Scanner:** Recursively globs .md files in target folders.  
2. **Processor:** Converts raw text to mdast (Markdown AST).  
3. **Transclusion & Media:** Resolves local file paths and fetches linked block nodes.  
4. **Layout Extractor:** Uses state-machine logic to chunk nodes into Front and Back card buffers based on heading depth and user-defined delimiters (default `:::`; `?` and other strings are supported).
5. **Injector:** Calculates exact byte-offsets on the **pre-graft** AST to safely inject tracking IDs back into the source Obsidian file via async-mutex locking; merges grafted compile buffers without shifting offsets.  
6. **Anki Sync:** Compiles AST buffers to raw HTML, detects duplicate fronts vault-wide, normalizes code-block line endings for field compare, and syncs to Anki via batched `addNotes` / parallel updates (see [Docs/Sync-Performance-Roadmap.md](Docs/Sync-Performance-Roadmap.md)).

## **📦 Prerequisites**

* **Bun:** v1.0.0 or higher (or Node.js v18+ with Bun installed).  
* **Anki Desktop:** Running locally (required for live sync; not needed for dry-run).  
* **AnkiConnect:** Installed in Anki (Add-on code: 2055492159).

## **🛠 Installation**

```bash
git clone https://github.com/zunaidFarouque/Obsidian-Anki-AST-Engine.git
cd Obsidian-Anki-AST-Engine
bun install
bun run build
```

Copy `config.json.example` to `config.json` and set your vault path.

## **⚙️ Configuration**

Create a `config.json` in the root directory. This config is strictly validated at runtime via Zod.

**Note:** Files must include frontmatter with `AnkiSync: on` (or `true` / `yes`) to be synced. Set `AnkiSync: off` (or `false` / `no`) to disable sync for a card file without removing the key. Files without an `AnkiSync` key are ignored. This is an engine-specific gate—not required by Obsidian itself. Optional frontmatter keys include `cardDeclarationHeadingLevel` (1–6, default from config), `delimiter` (overrides the config delimiter for that file), and `includeParentHeadersAsTags` (overrides the config tag behavior). See [Docs/Engine-Architecture.md](Docs/Engine-Architecture.md) for the full engine contract (including read-only AST and surgical ID injection) and [Docs/Obsidian-Parity.md](Docs/Obsidian-Parity.md) for link/embed resolution rules.

```json
{
  "vaultPath": "/Users/username/Documents/ObsidianVault",
  "delimiter": ":::",
  "scanFolders": ["01 - Computer Science", "Notes"],
  "defaultAnkiDeck": "Synced from Obsidian",
  "defaultEngineTag": "Obsidian-Anki-AST",
  "ankiConnectUrl": "http://127.0.0.1:8765",
  "linkFormat": "shortest",
  "attachmentFolder": "attachments",
  "defaultCardDeclarationHeadingLevel": 4,
  "includeParentHeadersAsTags": true
}
```

## **💻 Usage**

To execute a dry-run (parses AST and logs intended Anki actions without modifying files or database):

```bash
bun run sync -- --dry-run
```

Each line of output is a JSON `SyncAction` with compiled `frontHtml` and `backHtml` fields (see [Docs/Card-Rendering.md](Docs/Card-Rendering.md)). Duplicate warnings (if any) are printed to **stderr** as `{"event":"duplicate_warning",…}`.

To execute a full synchronization (requires Anki Desktop + AnkiConnect):

```bash
bun run sync
```

Check AnkiConnect connectivity:

```bash
bun run sync -- --check
```

See [Docs/Anki-Integration.md](Docs/Anki-Integration.md) for Anki setup, ID binding, and troubleshooting. Live sync performance (batched adds, HTTP throttling): [Docs/Sync-Performance-Roadmap.md](Docs/Sync-Performance-Roadmap.md).

## **🔌 Obsidian plugin**

An in-vault plugin scaffold lives in [`plugin/`](plugin/). Build it with `bun run build:plugin` (requires `dist/` from the engine). See [plugin/README.md](plugin/README.md) for local install steps.

## **🧪 Test-Driven Development (TDD)**

This project strictly adheres to TDD to handle the immense edge cases of personal knowledge management workflows. Before contributing new features, refer to the fixtures directory (`tests/fixtures/`).

To run the test suite:

```bash
bun test
```

## **🤝 Contributing**

Contributions are welcome\! Please ensure you have read the architectural docs in the `docs/` folder ([Engine-Architecture.md](Docs/Engine-Architecture.md), [Obsidian-Parity.md](Docs/Obsidian-Parity.md), [Sync-Performance-Roadmap.md](Docs/Sync-Performance-Roadmap.md)) before opening a PR. All parsing modifications must include an accompanying edge-case fixture test.

