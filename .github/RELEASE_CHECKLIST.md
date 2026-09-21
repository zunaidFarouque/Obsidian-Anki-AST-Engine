# Obsidian Community Plugins Release Checklist

This document details the exact steps to publish **Anki AST Sync** to the official Obsidian Community Plugins directory.

---

## Current Status & Verification ✅

All preparation and release automation steps have been completed:

1. **Repository Alignment**:
   - `manifest.json` (root) & `plugin/manifest.json`: ID is `anki-ast-sync`, display name `Anki AST Sync`, version `0.1.0`, minAppVersion `1.8.7`.
   - `LICENSE`: Valid MIT license with copyright present in repository root.
   - `README.md`: Comprehensive user guide with prerequisites, syntax examples, and features present in repository root.
   - `plugin/versions.json`: Set to `{"0.1.0": "1.8.7"}`.
2. **Quality & Compliance**:
   - Full test suite: **800 passing tests** across 90 test suites (`bun test`).
   - Linter: **0 errors** under `eslint-plugin-obsidianmd` (`cd plugin && bun run lint`).
   - Production bundle: Builds cleanly via `bun run build:plugin`.
3. **Automated CI/CD Release**:
   - Workflow: `.github/workflows/release.yml` triggers on version tag push (`*`).
   - Git Tag: `0.1.0` has been created and pushed to `origin`.
   - GitHub Release: Published at `https://github.com/zunaidFarouque/Obsidian-Anki-AST-Engine/releases/tag/0.1.0` with assets:
     - `main.js`
     - `manifest.json`
     - `styles.css`

---

## Submission Options

Obsidian supports submitting your plugin via the new developer portal (recommended) or via a GitHub pull request.

### Option 1: Submit via the Obsidian Community Portal (Recommended)

1. Open [community.obsidian.md](https://community.obsidian.md) and sign in with your Obsidian account.
2. Ensure your GitHub account (`zunaidFarouque`) is linked to your Obsidian profile.
3. Click **Add a plugin** (or **Submit plugin**).
4. Select or enter repository: `zunaidFarouque/Obsidian-Anki-AST-Engine`.
5. The portal will automatically inspect the `manifest.json` at the root of the `main` branch and verify the GitHub Release assets for tag `0.1.0`.
6. Review the automated pre-flight checks and click **Submit for Review**.

---

### Option 2: Submit via Pull Request to `obsidianmd/obsidian-releases`

If submitting via the traditional GitHub PR route:

1. Fork the [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) repository.
2. Edit `community-plugins.json` on a new branch.
3. Append the following entry to the end of the JSON array in `community-plugins.json`:

```json
	{
		"id": "anki-ast-sync",
		"name": "Anki AST Sync",
		"author": "zunaidFarouque",
		"description": "Sync flashcards directly to Anki using an AST markdown engine via AnkiConnect.",
		"repo": "zunaidFarouque/Obsidian-Anki-AST-Engine"
	}
```

4. Commit and push the branch to your fork.
5. Open a Pull Request targeting `obsidianmd/obsidian-releases:master` with title:
   `Add Anki AST Sync plugin`
6. Fill out the PR template checklist confirming adherence to the developer policies.

---

## Verification via BRAT (Optional Beta Testing)

To verify the release bundle exactly as Obsidian downloads it:

1. Install and enable the community plugin **Obsidian42 - BRAT** in Obsidian.
2. In **Settings → BRAT → Add Beta plugin**, enter:
   `zunaidFarouque/Obsidian-Anki-AST-Engine`
3. Confirm that Obsidian downloads `main.js`, `manifest.json`, and `styles.css` from the `0.1.0` release and activates the plugin.
