# Repository Rules & Context

## Package Manager & Tooling
* **Always use `bun`** — never `npm`, `yarn`, or `pnpm`.
  * Installation / packages: `bun install`, `bun add <pkg>`, `bun add -d <pkg>`, `bun remove <pkg>`.
  * Script execution & tests: `bun run <script>`, `bun test`.

## Project Context: Obsidian Plugin & AST Engine
* This repository is an **Obsidian Community Plugin** (`plugin/`) built on top of a headless AST engine core (`src/`).
* **Runtime distinction**:
  * **Obsidian Plugin (`plugin/`)**: Runs inside Obsidian Desktop (Electron / Chromium). Bundled via esbuild to `plugin/main.js`. Do not use Bun-only runtime APIs or unshimmed Node APIs inside plugin runtime code.
  * **Engine CLI & Tooling (`src/`, `scripts/`, `tests/`)**: Runs directly under **Bun** runtime.
