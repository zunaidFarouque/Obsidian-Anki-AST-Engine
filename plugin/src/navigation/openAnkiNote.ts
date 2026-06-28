import type { AnkiConnectClient } from 'obsidian-anki-ast-engine/anki';

export async function openAnkiNote(
	client: AnkiConnectClient,
	noteId: number,
): Promise<void> {
	await client.invoke('guiBrowse', { query: `nid:${noteId}` });
}
