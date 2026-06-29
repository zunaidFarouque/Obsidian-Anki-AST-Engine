import type { AnkiConnectClient } from "./client";
import type { VaultOrphan } from "./orphanDetect";
import { normalizeAnkiTagList } from "./tagNormalize";

export type OrphanAction = {
  ankiNoteId: number;
  uuid: string;
  action: "ignore" | "delete" | "suspend";
};

export type ApplyOrphanActionOptions = {
  ignoreTag: string;
};

export async function applyOrphanAction(
  client: AnkiConnectClient,
  orphans: VaultOrphan[],
  action: OrphanAction["action"],
  options?: ApplyOrphanActionOptions,
): Promise<OrphanAction[]> {
  if (orphans.length === 0) {
    return [];
  }

  const results: OrphanAction[] = orphans.map((orphan) => ({
    ankiNoteId: orphan.ankiNoteId,
    uuid: orphan.uuid,
    action,
  }));

  if (action === "delete") {
    await client.deleteNotes(orphans.map((orphan) => orphan.ankiNoteId));
    return results;
  }

  if (action === "ignore") {
    const ignoreTag = options?.ignoreTag;
    if (!ignoreTag) {
      throw new Error("ignoreTag is required for ignore orphan action");
    }

    await Promise.all(
      orphans.map((orphan) =>
        client.updateNoteTags(
          orphan.ankiNoteId,
          normalizeAnkiTagList([...orphan.tags, ignoreTag]),
        ),
      ),
    );
    return results;
  }

  const cardIdBatches = await Promise.all(
    orphans.map((orphan) => client.findCards(`nid:${orphan.ankiNoteId}`)),
  );
  const cardIds = cardIdBatches.flat();
  await client.suspend(cardIds);
  return results;
}
