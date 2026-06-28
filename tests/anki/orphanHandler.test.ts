import { describe, expect, mock, test } from "bun:test";
import { applyOrphanAction } from "../../src/anki/orphanHandler";
import type { VaultOrphan } from "../../src/anki/orphanDetect";
import type { AnkiConnectClient } from "../../src/anki/client";

const orphans: VaultOrphan[] = [
  {
    ankiNoteId: 201,
    uuid: "orphan-a",
    tags: ["obsidian-id::orphan-a"],
  },
  {
    ankiNoteId: 202,
    uuid: "orphan-b",
    tags: ["obsidian-id::orphan-b"],
  },
];

describe("applyOrphanAction", () => {
  test("delete calls deleteNotes with all orphan note ids", async () => {
    const deleteNotes = mock(async (noteIds: number[]) => {
      expect(noteIds).toEqual([201, 202]);
    });

    const client = {
      deleteNotes,
    } as unknown as AnkiConnectClient;

    const actions = await applyOrphanAction(client, orphans, "delete");
    expect(actions).toHaveLength(2);
    expect(deleteNotes).toHaveBeenCalledTimes(1);
  });

  test("suspend finds cards per note then suspends them", async () => {
    const invokeMulti = mock(async () => [[11, 12], [21]]);
    const suspendCards = mock(async (cardIds: number[]) => {
      expect(cardIds).toEqual([11, 12, 21]);
    });

    const client = {
      invokeMulti,
      suspendCards,
    } as unknown as AnkiConnectClient;

    const actions = await applyOrphanAction(client, orphans, "suspend");
    expect(actions).toHaveLength(2);
    expect(invokeMulti).toHaveBeenCalledTimes(1);
    expect(suspendCards).toHaveBeenCalledTimes(1);
  });
});
