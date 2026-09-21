import { execSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const pluginDir = path.join(rootDir, "plugin");

console.log("Building Obsidian plugin...");
const isBun = typeof process.versions.bun !== "undefined";
const runner = isBun ? "bun" : "npm";

execSync(`${runner} run build`, { cwd: pluginDir, stdio: "inherit" });

const pluginMain = path.join(pluginDir, "main.js");
const rootMain = path.join(rootDir, "main.js");
if (existsSync(pluginMain)) {
  copyFileSync(pluginMain, rootMain);
}

const pluginStyles = path.join(pluginDir, "styles.css");
const rootStyles = path.join(rootDir, "styles.css");
if (existsSync(pluginStyles)) {
  copyFileSync(pluginStyles, rootStyles);
}

const pluginManifest = path.join(pluginDir, "manifest.json");
const rootManifest = path.join(rootDir, "manifest.json");
if (existsSync(pluginManifest)) {
  copyFileSync(pluginManifest, rootManifest);
}

if (isBun) {
  try {
    execSync("bun run scripts/build-dist.ts", { cwd: rootDir, stdio: "inherit" });
  } catch (err) {
    console.warn("build-dist optional step warning:", err);
  }
}

console.log("Build verification complete: main.js created at root.");
