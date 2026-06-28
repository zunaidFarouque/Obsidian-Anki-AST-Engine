import { copyFile, mkdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const PLUGIN_DIR = join(REPO_ROOT, "plugin");
const DEPLOY_PATH_FILE = join(PLUGIN_DIR, "deploy.path");

const ARTIFACTS = ["main.js", "manifest.json", "styles.css"] as const;

async function readDeployTarget(): Promise<string> {
  const fromEnv = process.env.OBSIDIAN_PLUGIN_DIR?.trim();
  if (fromEnv) {
    return resolve(fromEnv);
  }

  const fromCli = process.argv[2]?.trim();
  if (fromCli) {
    return resolve(fromCli);
  }

  try {
    const raw = await Bun.file(DEPLOY_PATH_FILE).text();
    const line = raw
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find((entry) => entry.length > 0 && !entry.startsWith("#"));

    if (line) {
      return resolve(line);
    }
  } catch {
    // fall through
  }

  throw new Error(
    [
      "Obsidian plugin deploy path not configured.",
      "",
      "Use one of:",
      "  1. Copy plugin/deploy.path.example to plugin/deploy.path and set your vault path",
      "  2. OBSIDIAN_PLUGIN_DIR env var",
      "  3. bun run deploy:plugin -- <path-to-plugin-folder>",
    ].join("\n"),
  );
}

async function assertArtifactsExist(): Promise<void> {
  for (const name of ARTIFACTS) {
    const path = join(PLUGIN_DIR, name);
    try {
      await access(path);
    } catch {
      throw new Error(
        `Missing ${name}. Run: bun run build:plugin`,
      );
    }
  }
}

async function main(): Promise<void> {
  await assertArtifactsExist();

  const targetDir = await readDeployTarget();
  await mkdir(targetDir, { recursive: true });

  for (const name of ARTIFACTS) {
    const source = join(PLUGIN_DIR, name);
    const destination = join(targetDir, name);
    await copyFile(source, destination);
    console.error(`Copied ${name} -> ${destination}`);
  }

  console.error(`Deploy complete: ${targetDir}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Deploy failed: ${message}`);
  process.exit(1);
});
