# **Obsidian-Anki AST Engine 🧠⚡️**

A deterministic, headless Node.js synchronization pipeline bridging Obsidian and Anki.

Traditional sync tools rely on fragile Regular Expressions (Regex) that break when confronted with modern Markdown complexities like nested code blocks, escaped characters, and deeply linked block transclusions.

This engine solves that by transforming your Obsidian vault into a traversable **Abstract Syntax Tree (AST)**. By understanding the semantic structure of your notes, it achieves flawless, non-destructive, two-way synchronization with Anki.

## **✨ Core Features**

* **Deterministic AST Parsing:** Powered by the unified and remark ecosystem. Parses flashcard layouts structurally, completely ignoring delimiters hidden inside code, inlineCode, or math blocks.  
* **Deep Transclusion Resolution:** Native support for Obsidian block embeds (\!\[\[SourceNote\#^block-id\]\]). The engine recursively fetches, parses, and grafts transcluded content directly into your flashcards before syncing.  
* **Local Media Syncing:** Automatically detects embedded media (\!\[\[image.png\]\]), converts files to Base64 payloads, and queues them for injection via AnkiConnect.  
* **Surgical Two-Way Binding:** Generates and tracks unique UUIDs via HTML comments (\<\!--anki-id: uuid--\>). ID injection utilizes exact byte-offset coordinates on the raw file buffer, guaranteeing **zero formatting mutation** to your original Markdown.  
* **Stateless Concurrency Control:** Safely handles large media vaults using throttled async queues (p-limit) to prevent overwhelming the AnkiConnect Python server.

## **🚀 Architecture Overview**

The system operates strictly headlessly, reading from an absolute vault path and talking to a local AnkiConnect instance.

1. **Scanner:** Recursively globs .md files in target folders.  
2. **Processor:** Converts raw text to mdast (Markdown AST).  
3. **Transclusion & Media:** Resolves local file paths and fetches linked block nodes.  
4. **Layout Extractor:** Uses state-machine logic to chunk nodes into Front and Back card buffers based on heading depth and user-defined delimiters (e.g., ?).  
5. **Injector:** Calculates exact byte-offsets to safely inject tracking IDs back into the source Obsidian file via async-mutex locking.  
6. **Anki Sync:** Compiles AST buffers to raw HTML and dispatches throttled addNote / updateNoteFields payloads to Anki.

## **📦 Prerequisites**

* **Node.js:** v18.0.0 or higher.  
* **Anki Desktop:** Running locally.  
* **AnkiConnect:** Installed in Anki (Add-on code: 2055492159).

## **🛠 Installation**

git clone https://github.com/zunaidFarouque/Obsidian-Anki-AST-Engine.git  
cd Obsidian-Anki-AST-Engine  
npm install  
npm run build

## **⚙️ Configuration**

Create a config.json in the root directory. This config is strictly validated at runtime via Zod.

```
{  
  "vaultPath": "/Users/username/Documents/ObsidianVault",  
  "delimiter": "?",  
  "deckMappings": \[  
    {  
      "obsidianFolder": "01 \- Computer Science",  
      "ankiDeck": "Computer Science::Algorithms"  
    }  
  \],  
  "ankiConnectUrl": "http://127.0.0.1:8765"  
}
```

## **💻 Usage**

To execute a dry-run (parses AST and logs intended Anki actions without modifying files or database):
```
npm run sync \-- \--dry-run
```

To execute a full synchronization:

```
npm run sync
```

## **🧪 Test-Driven Development (TDD)**

This project strictly adheres to TDD to handle the immense edge cases of personal knowledge management workflows. Before contributing new features, refer to the fixtures directory (/tests/fixtures/).

To run the test suite:
```
npm run test
```

## **🤝 Contributing**

Contributions are welcome\! Please ensure you have read the architectural blueprint in the docs/ folder before opening a PR. All parsing modifications must include an accompanying edge-case fixture test.

