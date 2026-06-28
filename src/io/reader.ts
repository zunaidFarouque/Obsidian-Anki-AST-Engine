import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type ReadResult = {
  absolutePath: string;
  rawText: string;
};

export async function readMarkdownFile(filePath: string): Promise<ReadResult> {
  const absolutePath = resolve(filePath);
  const rawText = await readFile(absolutePath, "utf8");
  return { absolutePath, rawText };
}
