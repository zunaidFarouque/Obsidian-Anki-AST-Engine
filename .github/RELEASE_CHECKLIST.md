# Obsidian Community Plugins Release Checklist

This document provides the exact, copy-paste steps to publish **Anki AST Sync** to the official Obsidian Community Plugins directory.

---

## Step 1: Commit and Push Changes to GitHub

Ensure all your recent changes are committed and pushed to your GitHub repository:

```bash
git add .
git commit -m "chore: prepare plugin for obsidian community release"
git push origin main
```

---

## Step 2: Create and Push Version Tag

The release workflow is automated via GitHub Actions (`.github/workflows/release.yml`). Pushing a git tag matching the version in `manifest.json` (`0.1.0`) will automatically build the bundle and attach `manifest.json`, `main.js`, and `styles.css` to a new GitHub Release:

```bash
git tag 0.1.0
git push origin 0.1.0
```

### Verify the GitHub Release
1. Open `https://github.com/zunaidFarouque/Obsidian-Anki-AST-Engine/releases/tag/0.1.0`.
2. Ensure the release has the following 3 files attached under **Assets**:
   - `manifest.json`
   - `main.js`
   - `styles.css`

---

## Step 3: Test via BRAT (Beta Reviewer's Auto-update Tool)

Before submitting the official PR, test how Obsidian installs your release:

1. In Obsidian, install and enable the community plugin **Obsidian42 - BRAT**.
2. Open **Settings → Obsidian42 - BRAT**.
3. Under **Beta Plugin List**, click **Add Beta plugin**.
4. Enter: `zunaidFarouque/Obsidian-Anki-AST-Engine`.
5. Verify that Obsidian downloads the assets, enables **Anki AST Sync**, and operates without errors.

---

## Step 4: Submit Pull Request to `obsidianmd/obsidian-releases`

1. Fork the [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) repository.
2. Clone your fork locally or edit online on GitHub.
3. Open `community-plugins.json`.
4. Add your plugin entry to the bottom of the list (remembering to add a trailing comma to the previous entry):

```json
	{
		"id": "anki-ast-sync",
		"name": "Anki AST Sync",
		"author": "zunaidFarouque",
		"description": "Sync flashcards directly to Anki using an AST markdown engine via AnkiConnect.",
		"repo": "zunaidFarouque/Obsidian-Anki-AST-Engine"
	}
```

5. Commit and push your changes to your fork.
6. Open a Pull Request against `obsidianmd/obsidian-releases:master`.
7. Fill out the PR checklist template provided by Obsidian.

---

## Step 5: Post-Submission & Review

- **Automated Validation**: The Obsidian CI bot will run automated tests on your PR to verify that `repo`, `id`, `name`, and assets match.
- **Manual Review**: A member of the Obsidian team will review your plugin code and manifest. They may leave comments if minor adjustments are requested.
- **Merge**: Once approved and merged, your plugin will automatically appear in Obsidian's in-app Community Plugins browser!
