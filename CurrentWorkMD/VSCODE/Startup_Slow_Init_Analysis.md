# Obsidian startup slowdown (Anki-AST-Engine plugin) — findings

## Symptom
- Enabling the plugin increases Obsidian startup/init time by about ~5 seconds.

## Confirmed high-probability reasons (from code)

### 1) Heavy engine modules are imported eagerly during plugin load
- `plugin/src/main.ts` imports `runSyncFlow` (`./syncOrchestrator`) and `registerCardPreview` (`./cardPreview`) at top-level.
- `plugin/src/syncOrchestrator.ts` imports `runSync` from `obsidian-anki-ast-engine/sync`.
- `src/syncPipeline.ts` (the sync export) imports many heavy subsystems (AST parsing, transclusion, media, orphan/duplicate detection, etc.) immediately.

**Why this slows startup**  
Even before user clicks Sync, these modules are loaded and evaluated during `onload`, increasing cold-start CPU + module-eval time.

---

### 2) Card preview subsystem is always registered on startup
- In `plugin/src/main.ts`, `registerCardPreview(...)` is called unconditionally in `onload`.
- This happens even if `enableCardPreview` is `false` by default.

**Why this slows startup**  
Feature wiring, editor extension registration, and transitive module loading happen for all users, even when preview is disabled.

---

### 3) Markdown parser pipeline is expensive and rebuilt repeatedly
- `src/cardSyntax/parseCardDocument.ts` calls `parseMarkdown(...)`.
- `src/ast/processor.ts` creates a new `unified()` processor and attaches plugins (`remark-parse`, `remark-gfm`, `remark-math`, `remark-wiki-link`, custom link plugin) on each call.

**Why this slows startup / early editing**  
If preview parsing runs for active note(s), processor construction + AST work is expensive, especially for larger notes or multiple open editors.

## Potential/environmental reasons (not guaranteed, but plausible)

### A) Non-production plugin bundle may be used
- `plugin/esbuild.config.mjs` uses inline source maps when not in production mode.
- If a dev/watch bundle is copied into Obsidian, startup can be noticeably slower due to larger JS payload and parse time.

### B) Vault and note size characteristics
- Large active note(s), many open panes, or heavy markdown structures can amplify parse/decorate work.

### C) Windows local environment overhead
- Real-time antivirus/file scanning and plugin folder I/O overhead can increase module load time.

## What to do (recommended action plan)

## 1) Make startup lazy (highest impact)
- Move sync-related imports behind command callbacks (dynamic import on first use):
  - Lazy-load `./syncOrchestrator`
  - Lazy-load engine client pieces only when commands are invoked
- Register card preview only when `enableCardPreview === true`; if setting toggles ON later, register then.

## 2) Reduce parsing cost
- Reuse a cached `unified` processor instance instead of rebuilding it every parse.
- Keep debounce, but avoid parse work until absolutely needed (active file + feature enabled + live preview mode).

## 3) Verify production build path
- Ensure deployed plugin is built with production mode (`minify: true`, no inline sourcemap).
- Avoid deploying watch/dev output to Obsidian plugin directory.

## 4) Add startup instrumentation (quick win for proof)
- Add timing logs around:
  - `loadSettings`
  - command registration block
  - `registerCardPreview`
  - first parse call path
- Compare before/after lazy-loading changes to confirm where the ~5s is spent.

## Suggested implementation order
1. Lazy-load sync pipeline modules.
2. Gate/lazy-register card preview.
3. Cache markdown processor in AST parser.
4. Re-test startup timing in same vault.

