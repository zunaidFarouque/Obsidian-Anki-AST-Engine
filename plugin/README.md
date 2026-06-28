# Obsidian Anki AST Sync (plugin)

Obsidian plugin for the [Obsidian-Anki AST Engine](../readme.md). Lives in `plugin/` inside the engine monorepo.

## Development

1. Build the engine dist (required before plugin build):

   ```bash
   bun run build
   ```

2. Install plugin dependencies and build:

   ```bash
   cd plugin
   bun install
   bun run build
   ```

   Or from repo root: `bun run build:plugin`

3. Deploy into your vault (build + copy):

   ```bash
   bun run deploy:plugin
   ```

   Configure the destination once by copying `plugin/deploy.path.example` to `plugin/deploy.path`, or set `OBSIDIAN_PLUGIN_DIR`, or pass a path: `bun run copy:plugin -- "D:/vault/.obsidian/plugins/obsidian-anki-ast-sync"`.

4. Symlink or copy this folder into your vault’s plugins directory (manual alternative):

   ```
   <vault>/.obsidian/plugins/obsidian-anki-ast-sync/
   ```

   Required files: `main.js`, `manifest.json`, `styles.css`.

4. Enable **Obsidian Anki AST Sync** in Obsidian → Settings → Community plugins.

## AnkiConnect CORS

The plugin calls AnkiConnect from the browser. Add your Obsidian origin to `webCorsOriginList` in AnkiConnect config (see [Anki-Integration.md](../Docs/Anki-Integration.md)).

## Commands

- **Check AnkiConnect connection** — verifies Anki is reachable.
- **Sync vault to Anki** — live sync via the AST engine (base64 media, ID injection).

## Watch mode

```bash
cd plugin
bun run dev
```

Rebuilds `main.js` on source changes. Reload the plugin in Obsidian after each build.
