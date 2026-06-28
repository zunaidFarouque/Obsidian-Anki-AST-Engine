import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FIXTURES_DIR = join(import.meta.dir, "../tests/fixtures");

const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const ASSETS = [
  {
    url: "https://via.placeholder.com/320x240.png",
    path: join(FIXTURES_DIR, "Diagram.png"),
  },
  {
    url: "https://via.placeholder.com/320x240.png",
    path: join(FIXTURES_DIR, "Cell Diagram final.png"),
  },
  {
    url: "https://via.placeholder.com/160x120.png",
    path: join(FIXTURES_DIR, "assets/nested/path.png"),
  },
];

async function downloadOrFallback(url: string, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(path, buffer);
    console.log(`Downloaded ${path}`);
    return;
  } catch (error) {
    console.warn(`Download failed for ${url}, writing minimal PNG (${String(error)})`);
  }

  await writeFile(path, MINIMAL_PNG);
  console.log(`Saved minimal PNG ${path}`);
}

async function downloadFixtureAssets(): Promise<void> {
  for (const asset of ASSETS) {
    await downloadOrFallback(asset.url, asset.path);
  }
}

await downloadFixtureAssets();
