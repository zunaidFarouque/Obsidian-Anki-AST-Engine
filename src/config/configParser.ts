import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const DeckMappingSchema = z.object({
  obsidianFolder: z.string(),
  ankiDeck: z.string(),
});

export const ConfigSchema = z.object({
  vaultPath: z.string().min(1),
  delimiter: z.string().min(1).default(":::"),
  deckMappings: z.array(DeckMappingSchema).min(1),
  ankiConnectUrl: z.string().url().default("http://127.0.0.1:8765"),
  ankiConnectApiKey: z.string().min(1).optional(),
  noteModelName: z.string().min(1).default("Basic"),
  noteModelType: z.enum(["basic"]).default("basic"),
  autoCreateDecks: z.boolean().default(true),
  syncTagPrefix: z.string().min(1).default("obsidian-id"),
  linkFormat: z.enum(["shortest", "relative", "absolute"]).default("shortest"),
  attachmentFolder: z.string().optional(),
  defaultCardDeclarationHeadingLevel: z
    .number()
    .int()
    .min(1)
    .max(6)
    .default(4),
  includeParentHeadersAsTags: z.boolean().default(true),
});

export type Config = z.infer<typeof ConfigSchema>;
export type DeckMapping = z.infer<typeof DeckMappingSchema>;

export async function loadConfig(configPath?: string): Promise<Config> {
  const resolvedPath = configPath ?? join(process.cwd(), "config.json");
  const raw = await readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  return ConfigSchema.parse(parsed);
}
