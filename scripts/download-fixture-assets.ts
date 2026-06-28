import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

const FIXTURES_DIR = join(import.meta.dir, "../tests/fixtures");
const MIN_VALID_BYTES = 1000;

const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const MINIMAL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALcA/9k=",
  "base64",
);

const MINIMAL_WEBP = Buffer.from(
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",
  "base64",
);

const MINIMAL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

type FixtureAsset = {
  url: string;
  path: string;
};

const ASSETS: FixtureAsset[] = [
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png",
    path: join(FIXTURES_DIR, "Diagram.png"),
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png",
    path: join(FIXTURES_DIR, "Cell Diagram final.png"),
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png",
    path: join(FIXTURES_DIR, "assets/nested/path.png"),
  },
  {
    url: "https://picsum.photos/id/1015/400/300",
    path: join(FIXTURES_DIR, "assets/media/sample.jpg"),
  },
  {
    url: "https://www.gstatic.com/webp/gallery/1.sm.webp",
    path: join(FIXTURES_DIR, "assets/media/sample.webp"),
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif",
    path: join(FIXTURES_DIR, "assets/media/sample.gif"),
  },
];

function fallbackForPath(path: string): Buffer {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return MINIMAL_JPEG;
    case ".webp":
      return MINIMAL_WEBP;
    case ".gif":
      return MINIMAL_GIF;
    default:
      return MINIMAL_PNG;
  }
}

async function isValidFixtureFile(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);
    return fileStat.size >= MIN_VALID_BYTES;
  } catch {
    return false;
  }
}

async function downloadOrFallback(url: string, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  if (await isValidFixtureFile(path)) {
    console.log(`Keeping existing ${path}`);
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < MIN_VALID_BYTES) {
      throw new Error(`download too small (${buffer.length} bytes)`);
    }

    await writeFile(path, buffer);
    console.log(`Downloaded ${path} (${buffer.length} bytes)`);
    return;
  } catch (error) {
    if (await isValidFixtureFile(path)) {
      console.warn(`Download failed for ${url}; keeping existing file (${String(error)})`);
      return;
    }

    console.warn(
      `Download failed for ${url}; writing minimal ${extname(path) || "PNG"} (${String(error)})`,
    );
    await writeFile(path, fallbackForPath(path));
    console.log(`Saved minimal fallback ${path}`);
  }
}

async function syncCanonicalNamesFromManualAssets(): Promise<void> {
  const manualSources: Array<{ source: string; target: string }> = [
    {
      source: join(
        FIXTURES_DIR,
        "assets/nested/another folderrrr/toppng.com-cartoon-1254x1254.png",
      ),
      target: join(FIXTURES_DIR, "assets/nested/path.png"),
    },
    {
      source: join(FIXTURES_DIR, "assets/media/jpeg-home.jpg"),
      target: join(FIXTURES_DIR, "assets/media/sample.jpg"),
    },
    {
      source: join(FIXTURES_DIR, "assets/media/koala.webp"),
      target: join(FIXTURES_DIR, "assets/media/sample.webp"),
    },
  ];

  const gifDir = join(FIXTURES_DIR, "assets/media");
  let manualGif: string | undefined;
  try {
    const { readdir } = await import("node:fs/promises");
    for (const entry of await readdir(gifDir)) {
      if (entry.endsWith(".gif") && entry !== "sample.gif") {
        manualGif = join(gifDir, entry);
        break;
      }
    }
  } catch {
    // no manual gif directory
  }

  if (manualGif) {
    manualSources.push({
      source: manualGif,
      target: join(FIXTURES_DIR, "assets/media/sample.gif"),
    });
  }

  for (const { source, target } of manualSources) {
    if (!(await isValidFixtureFile(source))) {
      continue;
    }

    if (await isValidFixtureFile(target)) {
      continue;
    }

    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    console.log(`Copied manual asset ${source} -> ${target}`);
  }

  const nestedPng = join(FIXTURES_DIR, "assets/nested/path.png");
  if (await isValidFixtureFile(nestedPng)) {
    for (const rootName of ["Cell Diagram final.png", "Diagram.png"]) {
      const rootPath = join(FIXTURES_DIR, rootName);
      if (!(await isValidFixtureFile(rootPath))) {
        await copyFile(nestedPng, rootPath);
        console.log(`Copied ${nestedPng} -> ${rootPath}`);
      }
    }
  }
}

async function downloadFixtureAssets(): Promise<void> {
  await syncCanonicalNamesFromManualAssets();

  for (const asset of ASSETS) {
    await downloadOrFallback(asset.url, asset.path);
  }
}

await downloadFixtureAssets();
