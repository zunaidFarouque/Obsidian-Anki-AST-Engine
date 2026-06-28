# **Technical Design Document: Headless Obsidian-to-Anki AST Sync Engine**

> **Living document.** For the authoritative engine contract (AnkiSync gate, `:::` delimiter, declaration-mode cards, tag settings), see [Engine-Architecture.md](Engine-Architecture.md).

## **Architectural Context and The AST Paradigm Shift**

The synchronization of heavily interlinked, media-rich Markdown compilation notes into spaced repetition systems like Anki presents significant parsing challenges. Traditional systems that rely on regular expressions (Regex) to extract flashcards from plain text inevitably fail when confronted with the complex realities of modern note-taking workflows. Regex is inherently incapable of maintaining state or understanding nested contextual scopes, making it exceedingly fragile when faced with escaped characters, nested code blocks containing delimiter tokens, or deeply nested block transclusions.  
To circumvent the fundamental limitations of string-matching algorithms, this architectural blueprint defines a headless Node.js/TypeScript pipeline that bridges Obsidian and AnkiConnect by strictly utilizing an Abstract Syntax Tree (AST) approach. By transforming raw Markdown into a traversable data structure—specifically the Markdown Abstract Syntax Tree (mdast)—the system achieves deterministic parsing. This paradigm shift allows the engine to understand the semantic meaning of every character in the document. The architecture leverages the unified and remark ecosystems to seamlessly resolve local media, recursively graft transcluded block references, parse card fronts and backs via state-machine logic, and maintain two-way binding through non-destructive HTML comment injection based on exact byte-offsets.

## **Directory Structure and Domain-Driven Design**

The system architecture adheres to Domain-Driven Design (DDD) principles, ensuring a rigid separation of concerns between file system input/output (I/O), abstract syntax tree manipulation, state management, and HTTP synchronization with the local Anki instance.

```
/
├── package.json
├── tsconfig.json
├── config.json
├── src/
│   ├── index.ts
│   ├── syncPipeline.ts
│   ├── config/
│   │   └── configParser.ts
│   ├── io/
│   │   ├── scanner.ts
│   │   ├── reader.ts
│   │   ├── frontmatterFilter.ts
│   │   └── surgicalInjector.ts
│   ├── ast/
│   │   ├── processor.ts
│   │   ├── obsidianLinks.ts
│   │   ├── transclusionGraft.ts
│   │   ├── mediaResolver.ts
│   │   └── blockIdTagging.ts
│   ├── parser/
│   │   ├── stateMachine.ts
│   │   └── delimiterCheck.ts
│   ├── obsidian/
│   │   ├── linkResolver.ts
│   │   └── vaultIndex.ts
│   ├── anki/
│   │   ├── client.ts          # AnkiConnect HTTP (stub)
│   │   ├── syncEngine.ts      # Live sync dispatch (stub)
│   │   └── mediaQueue.ts
│   └── utils/
│       ├── hash.ts
│       ├── mutexMap.ts
│       └── textPreview.ts
└── tests/
    ├── fixtures/
    ├── ast/
    ├── parser/
    └── ...
```

The `/src/ast/` directory is the core processing hub. Obsidian embeds are handled via `obsidianLinks.ts` and `remark-wiki-link`, then resolved through `transclusionGraft.ts` and `src/obsidian/linkResolver.ts`.  
The `/src/parser/` directory contains the state machine that groups headings and content into discrete Anki flashcards using declaration-level headings (default H4) or legacy `###` mode.  
The `/src/io/frontmatterFilter.ts` module gates sync on `AnkiSync` frontmatter and resolves per-file overrides for delimiter, declaration level, and tag behavior.  
The `/src/io/surgicalInjector.ts` module injects `<!--anki-id: uuid-->` at exact byte offsets without remark-stringify reformatting.  
The `/src/anki/` directory encapsulates AnkiConnect operations and throttled media upload queuing.

## **Dependency Matrix and Ecosystem Justification**

The technology stack relies heavily on the unified ecosystem, specifically the remark suite for Markdown processing, alongside specialized concurrency management tools to prevent network and I/O bottlenecks. The selection of these specific dependencies is fundamental to the stability of the system.

| Package | Version | Architectural Role and Justification |
| :---- | :---- | :---- |
| unified | ^11.0.0 | The core interface for parsing, inspecting, transforming, and serializing content through syntax trees. It acts as the pipeline orchestrator6. |
| remark-parse | ^11.0.0 | Converts raw markdown strings into the standard mdast structure, providing the fundamental graph of nodes that the system traverses7. |
| remark-gfm | ^4.0.0 | Adds support for tables, strikethrough, and task lists. This is required to match Obsidian's strict adherence to GitHub Flavored Markdown (GFM)9. |
| remark-wiki-link | ^2.0.0 | Parses Obsidian-style \[\[wikilinks\]\] and \!\[\[embeds\]\] into distinct AST nodes with data.alias and data.permalink properties, avoiding the need for custom parsing logic2. |
| unist-util-visit-parents | ^6.0.0 | A traversal utility that allows the system to walk the tree while maintaining a stack of ancestors. This is critical for determining if a delimiter exists inside a code block10. |
| unist-util-is | ^6.0.0 | A utility to strictly verify node types and properties during state-machine transitions, ensuring type safety when casting generic AST nodes12. |
| p-limit | ^5.0.0 | A stateless concurrency limiter. It restricts the number of active promises, which is essential for throttling storeMediaFile requests to AnkiConnect and preventing socket timeouts4. |
| async-mutex | ^0.4.0 | Implements asynchronous locking mechanisms. It prevents race conditions when overlapping asynchronous transclusion resolutions attempt to read or inject IDs into the same file simultaneously16. |
| zod | ^3.22.0 | TypeScript-first schema validation. Used to rigorously validate the config.json inputs and ensure the runtime type safety of AnkiConnect API responses18. |
| fast-glob | ^3.3.0 | High-performance, recursive directory scanner utilized to locate all .md files within the configured Obsidian vault quickly. |

The decision to utilize p-limit over alternatives like p-queue stems from the architectural requirement for stateless concurrency control. While p-queue offers robust priority queueing and pausing capabilities, the sync engine requires a lightweight, low-overhead mechanism to strictly cap concurrent HTTP requests to the local Anki instance4. Similarly, async-mutex is favored for local file I/O because it provides exclusive lock access to critical sections of the file system, ensuring that overlapping threads attempting to update the same Obsidian note do not corrupt the raw text buffer17.

## **Configuration and Input Orchestration**

The engine operates entirely in a headless environment, driven by a strict `config.json` schema validated at runtime by Zod. The configuration dictates:

- Absolute vault path and folder-to-deck mappings
- Default delimiter (`:::`) and optional per-file override via frontmatter
- Default card declaration heading level (H4) and parent-header tag behavior
- AnkiConnect URL, link format, and attachment folder rules

See [Engine-Architecture.md](Engine-Architecture.md) for the full schema.

Upon initialization, the configuration parser reads the file and instantiates the Zod schema. If validation fails, the pipeline terminates immediately. The scanner uses fast-glob to locate `.md` files under mapped folders, ignoring `.obsidian`, `.trash`, and hidden paths.

### **Frontmatter gating (`AnkiSync`)**

Before AST processing, each file is read and parsed for YAML frontmatter. Files are **skipped** unless `AnkiSync` is set to `on`, `true`, or `yes` (case-insensitive). Files without frontmatter, without the key, with `off`/`false`/`no`, or with invalid values are ignored. This replaces the former `type: flashcard` + `status: active` gate.

Per-file overrides (when present): `cardDeclarationHeadingLevel`, `delimiter`, `includeParentHeadersAsTags`.

For each sync-eligible file, `syncPipeline.ts` orchestrates parse → graft → media → extract → injection planning.

## **AST Parsing and Transclusion Resolution**

The transformation of Markdown into a traversable Abstract Syntax Tree is the foundational mechanism of this engine. The unified processor is configured with remark-parse to tokenize the document, remark-gfm to handle extended syntax, and remark-wiki-link to isolate Obsidian-specific internal links2. The resulting mdast structure represents the document as a hierarchy of objects, each containing a type, value, position, and children3.

### **Deep Media Resolution**

During the traversal of the AST, the system must identify and process media assets to ensure they render correctly within the Anki client. The mediaResolver.ts module uses unist-util-visit to locate nodes of type image (standard Markdown images) and wikiLink nodes where the isType property indicates an embed (Obsidian image embeds)2.  
When a media node is intercepted, the engine extracts the file name and resolves the local absolute path by cross-referencing the Obsidian vault root. Because AnkiConnect's storeMediaFile endpoint requires binary data to be transmitted as a Base64-encoded string, the engine reads the local file buffer, executes the conversion, and pushes the payload into a throttled p-limit queue22. Once the AnkiConnect API confirms the successful storage of the media file in Anki's SQLite database22, the AST node's URL property is rewritten. It is modified from the local Obsidian path to the newly stored filename, ensuring that when the card is eventually compiled into HTML, the src attribute correctly points to the internal Anki media directory.

### **Asynchronous Transclusion Grafting**

Obsidian's block transclusion syntax (\!\[\[SourceNote\#^block-id\]\]) allows users to embed specific paragraphs or lists from one note directly into another. Resolving these embeds is critical, as a flashcard may rely on information stored in a disparate file25.  
When the remark-wiki-link parser identifies an embed pointing to a specific block ID, the primary AST traversal pauses. The engine extracts the target file name and the appended hash fragment (e.g., ^block-id). It then acquires an asynchronous read lock for the target file using async-mutex16. The target file is read and parsed into a secondary, isolated AST.  
A custom visitor searches this secondary AST for block nodes—typically paragraph, list, or blockquote nodes—that terminate with a text node matching the specific block ID. Once identified, the engine extracts the target node, strips the visible ^block-id text to ensure clean rendering in Anki, and clones the subtree. The cloned nodes are then grafted directly into the primary AST, replacing the original wikiLink embed node. This recursive grafting mechanism ensures that deeply nested transclusions are fully expanded before the state machine attempts to extract flashcards, creating a seamless, unified document structure.

## **State-Machine Card Extraction (The Layout)**

With the AST fully resolved and expanded, the system shifts to the extraction phase. The `stateMachine.ts` module iterates over the root AST children, maintaining front/back node buffers and a phase state.

### **Declaration mode (default)**

When `cardDeclarationHeadingLevel` is set (default **4** from config):

- Headings **above** the declaration level (H1–H3) accumulate **tag context** (e.g. `CS101::Week 2`)
- Headings **at** the declaration level (H4) start a new card
- The declaration heading may serve as the front, or separate prose may precede the delimiter
- When `includeParentHeadersAsTags` is `true`, the tag joins context + declaration: `CS101::Week 2::Entropy`
- When `false`, the tag is the declaration heading only: `Entropy`

### **Legacy mode**

When extraction runs without a declaration level, any heading starts a card and the tag equals the heading text.

### **Delimiter pivot (`:::` default)**

The engine checks text nodes for the configured delimiter (default `:::`). `delimiterCheck.ts` uses `unist-util-visit-parents` to ignore delimiters inside `code`, `inlineCode`, or `math`. A structural match bifurcates the text node if needed and transitions to back collection. Standalone delimiter paragraphs (a line containing only `:::`) are supported.

The `?` delimiter remains available via config or frontmatter override, with additional rules to avoid ternary-operator false positives.

Collection continues until the next card boundary (declaration heading or equal/higher depth heading in legacy mode).

## **ID Management, Two-Way Binding, and Surgical Injection**

The most delicate operation in a headless synchronization pipeline is maintaining a stable, two-way binding between the source Markdown file and the target database without degrading the user's authoring experience. The system must inject a unique identifier into the Obsidian note to track updates, renames, and deletions.  
A naive approach would involve modifying the AST to include the ID and then passing the entire tree through remark-stringify to overwrite the original file. However, remark-stringify is highly opinionated; it destructively reformats the Markdown output to enforce its own style guide (e.g., standardizing unordered lists to asterisks, altering whitespace, and escaping certain punctuation)8. Saving a file via remark-stringify would result in massive, unwanted version-control diffs across the user's entire vault.  
To preserve the raw document exactly as the user authored it, the engine employs a surgical injection pattern. The mdast specification dictates that every node generated by remark-parse contains a position object, which includes the exact start and end byte offsets relative to the original raw source string3.  
When the state machine concludes the extraction of a card's Back buffer, it inspects the final node for an html node containing a specific comment structure: \<\!--anki-id: \[UUID\]--\>30. If this node is absent, the card is classified as a new entity. The system generates a highly collision-resistant UUID. Instead of stringifying the AST, the engine queries the position.end.offset of the very last node in the Back buffer. It then splices the HTML comment directly into the raw UTF-8 text string maintained in memory:

TypeScript  
const offset \= lastBackNode.position.end.offset;  
const newRawContent \= rawText.slice(0, offset) \+ \`\\n\<\!--anki-id: ${uuid}--\>\\n\` \+ rawText.slice(offset);

Before this new string is written to the disk, the thread must acquire an exclusive write lock for the specific file path via async-mutex16. This precise memory-offset manipulation guarantees zero formatting mutation outside of the explicitly injected HTML comment, preserving the integrity of the Obsidian vault.

## **AnkiConnect Synchronization Engine**

Once the flashcards are extracted and assigned unique identifiers, the AST buffers for the Front and Back are compiled into raw HTML strings using remark-rehype and rehype-stringify32. This HTML payload, alongside the derived tags and media references, is passed to the AnkiConnect synchronization engine.  
The synchronization module relies heavily on the p-limit utility to throttle HTTP requests to http://localhost:8765, ensuring the single-threaded Python server underpinning AnkiConnect is not overwhelmed5. For each card, the engine constructs a notesInfo payload to query the Anki database22.  
If the query returns null, indicating the UUID does not exist in the Anki database, the system constructs an addNote request, mapping the HTML strings to the configured Front and Back fields of the target deck22.  
Conversely, if the query returns an existing note, the engine performs a local diff against the retrieved fields. If the compiled HTML differs from the stored HTML, the system executes an updateNoteFields request, explicitly passing the updated Front and Back strings to overwrite the stale data22. Following a successful update, an updateNoteTags request is dispatched to ensure the Anki tags remain perfectly synchronized with the Obsidian heading hierarchy.

## **Test-Driven Development (TDD) Roadmap**

The architectural complexity of AST traversal and string manipulation necessitates a strict Test-Driven Development (TDD) methodology. Before any implementation logic is authored, a suite of highly specific edge-case fixtures must be established in the /tests/fixtures/ directory. The engine must successfully compile these structures into valid Anki payloads without mutating the original file beyond surgical ID injection.

| Fixture Name | Purpose and Constraints | Input Content Example | Expected AST Behavior |
| :---- | :---- | :---- | :---- |
| edge-case-delimiters-triple-colon.md | Verifies `:::` delimiter ignores `::` inside inline code. | Rust uses `foo::bar` in snippets, then standalone `:::` line. | Only the standalone `:::` triggers front/back split; code-span `::` is ignored. |
| edge-case-delimiters-in-code.md | Regression for `?` delimiter override; ternary in code must not split. | `condition ? true : false`. ? It is a shorthand. | `?` inside inlineCode ignored; standalone `?` splits. |
| multi-line-card-layout.md | Canonical H4 declaration layout with `AnkiSync: on` and `:::`. | H4 card with multi-line front, standalone `:::`, multi-line back. | Tags like `Computer Science::Card With Separate Front`; heading-as-front cards supported. |
| deep-nested-transclusions.md | Block embed resolution with cyclical guard. | `![[Design#^singleton]]` then `:::`. | Grafted singleton text; embed marker removed from output. |
| missing-id-injection.md | Byte-offset UUID splice at card end. | `### Entropy ... ? ::: Randomness.` | Offset after back text; inject before next heading. |
| complex-media-paths.md | Media paths, spaces, nested assets. | `![[Cell Diagram final.png]]` then `:::`. | Media queued; card extracts with declaration-level tag. |
| malformed-html-comments.md | Empty or invalid `anki-id` comments. | `::: ` then `9.8 m/s^2` with `<!-- anki-id: -->`. | Treat as new card; plan fresh UUID injection. |
| ignore-invalid-no-sync-trigger.md | No `AnkiSync` key — file must be skipped. | Blog prose with card-shaped headings, no frontmatter gate. | `shouldSyncFile` returns false; zero sync actions. |

## **Text-Based Data Flow Diagram**

The operational pipeline functions as a sequential, heavily asynchronous directed acyclic graph (DAG). The following orchestration flow details the logical progression of data through the system's core modules.  
**[PHASE 1: INITIALIZATION & DISCOVERY]**  
(1) Parse config.json → Validate via Zod (vault path, delimiter `:::`, deck mappings, declaration level, tag settings).  
(2) Execute fast-glob → Generate array of all .md file paths in mapped directories.  
**[PHASE 2: PER-FILE GATE & AST COMPILATION]**  
(3) FOR EACH file in array:  
(a) fs.readFile(path, 'utf8') → Read into memory as raw text buffer.  
(b) frontmatterFilter.shouldSyncFile → Skip unless AnkiSync is on/true/yes.  
(c) unified().use(remarkParse)... → Tokenize text into Primary AST (mdast).  
**[PHASE 3: TRANSCLUSION RESOLUTION (ASYNC)]**  
(4) Traverse Primary AST via unist-util-visit.  
IF node \=== wikiLink AND embed \=== true:  
(a) Extract target file name and ^block-id.  
(b) Acquire async-mutex read lock for target file path.  
(c) Parse target file \-\> Generate Secondary AST.  
(d) Extract specific block node matching ID.  
(e) Replace original wikiLink node in Primary AST with extracted children.  
(f) Release async-mutex read lock.  
\[PHASE 4: MEDIA EXTRACTION & UPLOAD\]  
(5) Traverse Primary AST via unist-util-visit.  
IF node \=== image OR media wikiLink:  
(a) Resolve absolute file path relative to vault root.  
(b) Read file buffer \-\> Encode to Base64.  
(c) Push to p-limit Media Queue \-\> HTTP POST storeMediaFile.  
(d) Rewrite AST node URL property to match Anki's internal database filename.  
**[PHASE 5: LAYOUT EXTRACTION (STATE MACHINE)]**  
(6) Iterate over root block children (respecting bodyStartOffset past frontmatter).  
(a) IF heading at declaration level (default H4) → Start new card; build tag from parent headers when enabled.  
(b) Push nodes into Front buffer until structural `:::` (or configured delimiter).  
(c) IF delimiter validated AND unist-util-visit-parents confirms no code ancestry → Shift state to Back buffer.  
(d) Push nodes into Back until next declaration heading or card boundary.  
(e) Detect `<!--anki-id: [UUID]-->` html node at end of Back buffer.  
\[PHASE 6: TWO-WAY BINDING & SURGICAL INJECTION\]  
(7) FOR EACH extracted flashcard:  
(a) Compile Front and Back AST arrays \-\> HTML via remark-rehype & rehype-stringify.  
(b) IF Card lacks ID:  
\-\> Generate UUID.  
\-\> Acquire async-mutex write lock for origin file path.  
\-\> Slice raw text buffer using node.position.end.offset.  
\-\> Inject \<\!--anki-id: UUID--\> string.  
\-\> fs.writeFile to disk \-\> Release write lock.  
\-\> Route to Sync Queue as addNote.  
(c) IF Card possesses ID:  
\-\> Route to Sync Queue as updateNoteFields & updateNoteTags.  
\[PHASE 7: ANKICONNECT BATCH EXECUTION\]  
(8) Drain Sync Queue via p-limit(10) \-\> Execute HTTP POST payloads to local Anki instance.

## **Predictive Failure Analysis and Code-Level Mitigations**

To guarantee the reliability of the pipeline in massive Obsidian vaults containing tens of thousands of notes and media assets, three primary architectural bottlenecks have been identified. Left unchecked, these vulnerabilities would result in data corruption, network failure, or catastrophic formatting destruction.

### **Bottleneck 1: Race Conditions During I/O Write-Backs**

**Failure Mode:** Transclusions inherently cause overlapping file dependencies. If File A embeds a block from File B, and File C also embeds a block from File B, processing File A and File C concurrently introduces a race condition. If both threads independently determine that the flashcard residing in File B lacks an Anki ID, two separate execution contexts will generate divergent UUIDs and attempt to write them to File B simultaneously. This results in file corruption, double-injections, or process crashes due to locked file handles.  
**Code-Level Mitigation:** A global MutexMap will be implemented using the async-mutex library16. Before any read or write operation occurs on a specific file path, the thread must acquire an exclusive lock for that exact path.

TypeScript  
// Instantiated globally per file path  
const fileMutex \= mutexMap.get(absolutePath); 

await fileMutex.runExclusive(async () \=\> {  
    // 1\. Read file from disk to ensure the freshest state  
    const rawText \= await fs.readFile(absolutePath, 'utf8');  
    // 2\. Splice ID at the precisely calculated AST offset  
    const newText \= spliceIdIntoText(rawText, offset, uuid);  
    // 3\. Write modified string back to disk  
    await fs.writeFile(absolutePath, newText);  
});

This concurrency pattern guarantees that if File A initiates an ID injection into File B, File C's thread will patiently await its turn in the queue. Once File A releases the lock, File C will read the freshly written file, detect the newly injected ID via the AST, and safely update its state without duplicating the generation process.

### **Bottleneck 2: AnkiConnect Thread Blocking and Socket Timeouts**

**Failure Mode:** The AnkiConnect plugin operates as a synchronous, single-threaded HTTP server hosted within the Python environment of the Anki Desktop application. When a user syncs a vault containing hundreds of high-resolution images, the storeMediaFile action necessitates the transmission of massive Base64 payloads over localhost22. Because Node.js is heavily asynchronous, it will easily dispatch hundreds of concurrent fetch requests simultaneously, rapidly overflowing AnkiConnect's request backlog. This leads to ECONNRESET errors, socket timeouts, and silently dropped media files5.  
**Code-Level Mitigation:** All network requests directed at AnkiConnect will be rigorously routed through an abstraction layer managed by p-limit4. Rather than using a priority queue, simple stateless concurrency caps are established:

1. const mediaLimit \= pLimit(3); \- Base64 media uploads (storeMediaFile) are strictly throttled to a maximum concurrency of 3\. This drip-feeds the heavy payloads, ensuring the Python thread can process and write the binary data to SQLite without stalling.  
2. const syncLimit \= pLimit(10); \- Lightweight JSON requests (addNote, updateNoteFields, notesInfo) are throttled to a concurrency of 10, optimizing throughput without triggering API rejection logic22.

### **Bottleneck 3: Destructive Formatting Alterations via AST Serialization**

**Failure Mode:** As previously detailed, utilizing remark-stringify to reconstruct the Markdown string from the modified AST is fundamentally incompatible with Obsidian user workflows. remark-stringify applies an opinionated, rigid style guide during serialization8. If the pipeline parses an Obsidian file, injects a node for the ID, and pipes the result through the stringifier to save it, the user will experience devastating, non-consensual modifications to their whitespace, list markers, and escaped characters across their entire vault.  
**Code-Level Mitigation:** The pipeline entirely strips remark-stringify from the file write-back phase. Instead, it relies on the fact that remark-parse natively populates a position object on every single AST node. This object contains the exact start and end byte offsets relative to the unparsed source string3.  
When an ID must be injected, the engine queries the last AST node of the card's Back array, extracts its position.end.offset, and performs a surgical string splice directly into the raw UTF-8 buffer:

TypeScript  
// Surgical string splicing utilizing AST offset coordinates  
const offset \= lastBackNode.position.end.offset;  
const newContent \= rawText.slice(0, offset) \+ \`\\n\<\!--anki-id: ${uuid}--\>\` \+ rawText.slice(offset);

This precise mathematical manipulation circumvents the AST serialization process entirely. It guarantees absolute fidelity to the original Markdown document, ensuring zero formatting mutation outside of the explicitly injected tracking tag.

#### **Works cited**

1. flowershow/remark-wiki-link \- GitHub, [https://github.com/flowershow/remark-wiki-link](https://github.com/flowershow/remark-wiki-link)  
2. remark-wiki-link \- NPM, [https://www.npmjs.com/package/remark-wiki-link](https://www.npmjs.com/package/remark-wiki-link)  
3. Unist \- Universal Syntax Tree used by @unifiedjs \- GitHub, [https://github.com/syntax-tree/unist](https://github.com/syntax-tree/unist)  
4. p-limit vs p-queue vs p-throttle | Concurrency and Rate Limiting in JavaScript, [https://npm-compare.com/p-limit,p-queue,p-throttle](https://npm-compare.com/p-limit,p-queue,p-throttle)  
5. Gmail API Limits in 2026: Quotas, Rate Limits, and How to Handle Them \- Unipile, [https://www.unipile.com/gmail-api-limits/](https://www.unipile.com/gmail-api-limits/)  
6. ast \- Keywords \- unified, [https://unifiedjs.com/explore/keyword/ast/](https://unifiedjs.com/explore/keyword/ast/)  
7. remarkjs/remark: markdown processor powered by plugins part of the @unifiedjs collective \- GitHub, [https://github.com/remarkjs/remark](https://github.com/remarkjs/remark)  
8. remark \- Best of JS, [https://bestofjs.org/projects/remark](https://bestofjs.org/projects/remark)  
9. @jhuix/remark-gfm \- npm, [https://www.npmjs.com/package/@jhuix/remark-gfm](https://www.npmjs.com/package/@jhuix/remark-gfm)  
10. unist-util-visit-parents \- unified, [https://unifiedjs.com/explore/package/unist-util-visit-parents/](https://unifiedjs.com/explore/package/unist-util-visit-parents/)  
11. syntax-tree/unist-util-visit-parents \- GitHub, [https://github.com/syntax-tree/unist-util-visit-parents](https://github.com/syntax-tree/unist-util-visit-parents)  
12. Projects \- Explore \- unified, [https://unifiedjs.com/explore/project/](https://unifiedjs.com/explore/project/)  
13. Having Fun with Markdown and Remark \- GoCardless, [https://gocardless.com/blog/fun-with-markdown-and-remark](https://gocardless.com/blog/fun-with-markdown-and-remark)  
14. p-limit \- NPM, [https://www.npmjs.com/package/p-limit](https://www.npmjs.com/package/p-limit)  
15. Fetch Concurrency Control: Limit Simultaneous Requests with p-limit, [https://recca0120.github.io/en/2026/03/22/fetch-concurrent-requests/](https://recca0120.github.io/en/2026/03/22/fetch-concurrent-requests/)  
16. async-mutex \- NPM, [https://www.npmjs.com/package/async-mutex](https://www.npmjs.com/package/async-mutex)  
17. Advanced Concurrency Patterns in JavaScript: Semaphore, Mutex, Read-Write Lock, Deadlock Prevention and ResourceManager | by Artem Khrienov | Medium, [https://medium.com/@artemkhrenov/advanced-concurrency-patterns-in-javascript-semaphore-mutex-read-write-lock-deadlock-prevention-79e8bffb5b81](https://medium.com/@artemkhrenov/advanced-concurrency-patterns-in-javascript-semaphore-mutex-read-write-lock-deadlock-prevention-79e8bffb5b81)  
18. Andy-Stack/vaultkeeper-ai: A powerful AI assistant plugin that brings Claude, Gemini, Mistral and OpenAI directly into your Obsidian vault with intelligent note management capabilities. \- GitHub, [https://github.com/andy-stack/vaultkeeper-ai](https://github.com/andy-stack/vaultkeeper-ai)  
19. p-limit vs p-queue vs Bottleneck 2026 — PkgPulse Guides, [https://www.pkgpulse.com/guides/p-limit-vs-p-queue-vs-bottleneck-concurrency-control-2026](https://www.pkgpulse.com/guides/p-limit-vs-p-queue-vs-bottleneck-concurrency-control-2026)  
20. Simple TypeScript Mutex Implementation \- DEV Community, [https://dev.to/0916dhkim/simple-typescript-mutex-implementation-5544](https://dev.to/0916dhkim/simple-typescript-mutex-implementation-5544)  
21. syntax-tree/unist-util-visit \- GitHub, [https://github.com/syntax-tree/unist-util-visit](https://github.com/syntax-tree/unist-util-visit)  
22. AnkiConnect \- GitHub, [https://github.com/amikey/anki-connect](https://github.com/amikey/anki-connect)  
23. anki-editor.el \- GitHub, [https://github.com/louietan/anki-editor/blob/master/anki-editor.el](https://github.com/louietan/anki-editor/blob/master/anki-editor.el)  
24. Anki MCP Server, [https://mcpservers.org/servers/anki-mcp/anki-mcp-desktop](https://mcpservers.org/servers/anki-mcp/anki-mcp-desktop)  
25. Transclusion is a very underrated feature : r/ObsidianMD \- Reddit, [https://www.reddit.com/r/ObsidianMD/comments/1i27p64/transclusion\_is\_a\_very\_underrated\_feature/](https://www.reddit.com/r/ObsidianMD/comments/1i27p64/transclusion_is_a_very_underrated_feature/)  
26. Transclusion in Obsidian : r/ObsidianMD \- Reddit, [https://www.reddit.com/r/ObsidianMD/comments/mbale8/transclusion\_in\_obsidian/](https://www.reddit.com/r/ObsidianMD/comments/mbale8/transclusion_in_obsidian/)  
27. Full, complete Transclusion in block-level referencing \- Feature archive \- Obsidian Forum, [https://forum.obsidian.md/t/full-complete-transclusion-in-block-level-referencing/15300](https://forum.obsidian.md/t/full-complete-transclusion-in-block-level-referencing/15300)  
28. How to Modify Nodes in an Abstract Syntax Tree \- CSS-Tricks, [https://css-tricks.com/how-to-modify-nodes-in-an-abstract-syntax-tree/](https://css-tricks.com/how-to-modify-nodes-in-an-abstract-syntax-tree/)  
29. remark-comment-config CDN by jsDelivr \- A CDN for npm and GitHub, [https://www.jsdelivr.com/package/npm/remark-comment-config](https://www.jsdelivr.com/package/npm/remark-comment-config)  
30. Remark: How to parse HTML tags and their content in MDAST \- Stack Overflow, [https://stackoverflow.com/questions/67953711/remark-how-to-parse-html-tags-and-their-content-in-mdast](https://stackoverflow.com/questions/67953711/remark-how-to-parse-html-tags-and-their-content-in-mdast)  
31. remark-comment \- NPM, [https://www.npmjs.com/package/remark-comment](https://www.npmjs.com/package/remark-comment)  
32. HTML and remark \- unified, [https://unifiedjs.com/learn/recipe/remark-html/](https://unifiedjs.com/learn/recipe/remark-html/)  
33. rehype-stringify \- unified, [https://unifiedjs.com/explore/package/rehype-stringify/](https://unifiedjs.com/explore/package/rehype-stringify/)  
34. anki-connect \- Skill \- Smithery, [https://smithery.ai/skills/intellectronica/anki-connect](https://smithery.ai/skills/intellectronica/anki-connect)  
35. updateNoteFields not working properly? \- Development \- Anki Forums, [https://forums.ankiweb.net/t/updatenotefields-not-working-properly/1137](https://forums.ankiweb.net/t/updatenotefields-not-working-properly/1137)  
36. A general format for specifying links to a part of note (multiple paragraphs, ranges) / Embedding Multiple Consecutive Headings Or Blocks \- Feature requests \- Obsidian Forum, [https://forum.obsidian.md/t/a-general-format-for-specifying-links-to-a-part-of-note-multiple-paragraphs-ranges-embedding-multiple-consecutive-headings-or-blocks/19962](https://forum.obsidian.md/t/a-general-format-for-specifying-links-to-a-part-of-note-multiple-paragraphs-ranges-embedding-multiple-consecutive-headings-or-blocks/19962)  
37. rumdl/CHANGELOG.md at main \- GitHub, [https://github.com/rvben/rumdl/blob/main/CHANGELOG.md](https://github.com/rvben/rumdl/blob/main/CHANGELOG.md)  
38. How to Correctly Manage Concurrency in JavaScript \- Atomic Spin, [https://spin.atomicobject.com/javascript-concurrency/](https://spin.atomicobject.com/javascript-concurrency/)