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
    const findCards = mock(async (query: string) => {
      if (query === "nid:201") {
        return [11, 12];
      }
      if (query === "nid:202") {
        return [21];
      }
      return [];
    });
    const suspend = mock(async (cardIds: number[]) => {
      expect(cardIds).toEqual([11, 12, 21]);
    });

    const client = {
      findCards,
      suspend,
    } as unknown as AnkiConnectClient;

    const actions = await applyOrphanAction(client, orphans, "suspend");
    expect(actions).toHaveLength(2);
    expect(findCards).toHaveBeenCalledTimes(2);
    expect(suspend).toHaveBeenCalledTimes(1);
  });

  test("ignore adds orphan ignore tag via updateNoteTags", async () => {
    const updateNoteTags = mock(
      async (noteId: number, tags: string[]) => {
        if (noteId === 201) {
          expect(tags).toEqual([
            "obsidian-id::orphan-a",
            "obsidian-sync-ignore",
          ]);
          return;
        }
        if (noteId === 202) {
          expect(tags).toEqual([
            "obsidian-id::orphan-b",
            "obsidian-sync-ignore",
          ]);
        }
      },
    );

    const client = {
      updateNoteTags,
    } as unknown as AnkiConnectClient;

    const actions = await applyOrphanAction(client, orphans, "ignore", {
      ignoreTag: "obsidian-sync-ignore",
    });
    expect(actions).toEqual([
      { ankiNoteId: 201, uuid: "orphan-a", action: "ignore" },
      { ankiNoteId: 202, uuid: "orphan-b", action: "ignore" },
    ]);
    expect(updateNoteTags).toHaveBeenCalledTimes(2);
  });
});
