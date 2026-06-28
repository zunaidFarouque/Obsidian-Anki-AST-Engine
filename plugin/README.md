# Obsidian Anki AST Sync (plugin)

Obsidian plugin for the [Obsidian-Anki AST Engine](../readme.md). Lives in `plugin/` inside the engine monorepo.

## Development

1. Build the engine (required — plugin bundles from `../dist`):

   ```bash
   bun run build
   ```

   If `tsc` fails, ensure `dist/` is present from a prior successful build.

2. Install plugin dependencies and build:

   ```bash
   cd plugin
   bun install
   bun run build
   ```

3. Symlink or copy this folder into your vault’s plugins directory:

   ```
   <vault>/.obsidian/plugins/obsidian-anki-ast-sync/
   ```

   Required files: `main.js`, `manifest.json`, `styles.css`.

4. Enable **Obsidian Anki AST Sync** in Obsidian → Settings → Community plugins.

## AnkiConnect CORS

The plugin calls AnkiConnect from the browser. Add your Obsidian origin to `webCorsOriginList` in AnkiConnect config (see [Anki-Integration.md](../Docs/Anki-Integration.md)).

## Commands

- **Check AnkiConnect connection** — verifies Anki is reachable.
- **Sync vault to Anki** — placeholder; full vault adapter wiring is next.

## Watch mode

```bash
cd plugin
bun run dev
```

Rebuilds `main.js` on source changes. Reload the plugin in Obsidian after each build.
