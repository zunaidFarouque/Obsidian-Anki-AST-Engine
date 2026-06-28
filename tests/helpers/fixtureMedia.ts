import { stat } from "node:fs/promises";
import { join } from "node:path";

export const MIN_FIXTURE_MEDIA_BYTES = 1000;

export const COMPLEX_MEDIA_FIXTURE_FILES = [
  "assets/nested/another folderrrr/toppng.com-cartoon-1254x1254.png",
  "assets/nested/path.png",
  "assets/media/jpeg-home.jpg",
  "assets/media/koala.webp",
] as const;

export async function assertFixtureMediaReady(
  fixturesDir: string,
  files: readonly string[] = COMPLEX_MEDIA_FIXTURE_FILES,
): Promise<void> {
  const problems: string[] = [];

  for (const relativePath of files) {
    const absolutePath = join(fixturesDir, relativePath);
    try {
      const fileStat = await stat(absolutePath);
      if (fileStat.size < MIN_FIXTURE_MEDIA_BYTES) {
        problems.push(`${relativePath} (${fileStat.size} bytes)`);
      }
    } catch {
      problems.push(`${relativePath} (missing)`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Fixture media not ready: ${problems.join(", ")}. Run: bun run setup:fixtures`,
    );
  }
}
