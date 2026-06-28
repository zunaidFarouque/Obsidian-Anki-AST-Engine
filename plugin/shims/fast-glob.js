export default async function fg(): Promise<never> {
  throw new Error("fast-glob is unavailable in the Obsidian plugin runtime");
}
