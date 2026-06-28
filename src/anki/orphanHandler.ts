import type { AnkiConnectClient } from "./client";
import type { VaultOrphan } from "./orphanDetect";

export type OrphanAction = {
  ankiNoteId: number;
  uuid: string;
  action: "suspend" | "delete";
};

export async function applyOrphanAction(
  client: AnkiConnectClient,
  orphans: VaultOrphan[],
  action: "suspend" | "delete",
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

  const cardIdBatches = await client.invokeMulti<number[][]>(
    orphans.map((orphan) => ({
      action: "findCards",
      params: { query: `nid:${orphan.ankiNoteId}` },
    })),
  );
  const cardIds = cardIdBatches.flat();
  await client.suspendCards(cardIds);
  return results;
}
