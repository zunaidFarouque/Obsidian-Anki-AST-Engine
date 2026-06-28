import type { Config } from "../config/configParser";
import type { AnkiConnectClient } from "./client";
import { extractUuidFromTags } from "./syncEngine";

const NOTES_INFO_CHUNK_SIZE = 50;

export type VaultOrphan = {
  ankiNoteId: number;
  uuid: string;
  deck?: string;
  tags: string[];
};

export async function detectVaultOrphans(input: {
  client: AnkiConnectClient;
  config: Config;
  vaultBoundUuids: Set<string>;
}): Promise<VaultOrphan[]> {
  const { client, config, vaultBoundUuids } = input;
  const noteIds = await client.findNotes(`tag:"${config.defaultEngineTag}"`);
  if (noteIds.length === 0) {
    return [];
  }

  const orphans: VaultOrphan[] = [];

  for (let index = 0; index < noteIds.length; index += NOTES_INFO_CHUNK_SIZE) {
    const chunk = noteIds.slice(index, index + NOTES_INFO_CHUNK_SIZE);
    const notes = await client.notesInfo(chunk);

    for (const note of notes) {
      const uuid = extractUuidFromTags(note.tags, config.syncTagPrefix);
      if (!uuid || vaultBoundUuids.has(uuid)) {
        continue;
      }

      orphans.push({
        ankiNoteId: note.noteId,
        uuid,
        tags: note.tags,
      });
    }
  }

  return orphans;
}
