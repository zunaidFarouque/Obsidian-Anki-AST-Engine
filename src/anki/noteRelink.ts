import type { AnkiConnectClient, NoteInfo } from "./client";
import {
  buildKeywordSearchQueries,
  findNoteByFrontInDeck,
  frontsMatchForRecovery,
} from "./frontSearch";
import { normalizeAnkiTagPath, normalizeAnkiTagSegment } from "./tagNormalize";

export type RelinkPayload = {
  deck: string;
  tag: string;
  frontHtml: string;
};

function escapeAnkiQuotedText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildHeadingTagVariants(headingTag: string): string[] {
  const normalized = normalizeAnkiTagPath(headingTag);
  const lowerSegments = headingTag
    .split("::")
    .map((segment) => normalizeAnkiTagSegment(segment).toLocaleLowerCase())
    .filter((segment) => segment.length > 0)
    .join("::");

  return [...new Set([normalized, lowerSegments].filter((tag) => tag.length > 0))];
}

export function buildHeadingTagSearchQueries(
  deck: string,
  headingTag: string,
): string[] {
  const escapedDeck = escapeAnkiQuotedText(deck);
  return buildHeadingTagVariants(headingTag).map(
    (tag) => `deck:"${escapedDeck}" tag:"${escapeAnkiQuotedText(tag)}"`,
  );
}

function pickSingleRelinkMatch(
  notes: NoteInfo[],
  frontHtml: string,
  deck: string,
): NoteInfo | undefined {
  const frontMatches = notes.filter((note) =>
    frontsMatchForRecovery(note.fields.Front?.value ?? "", frontHtml),
  );

  if (frontMatches.length === 1) {
    return frontMatches[0];
  }

  if (frontMatches.length > 1) {
    throw new Error(
      `Multiple Anki notes in deck "${deck}" with matching Front field`,
    );
  }

  if (notes.length === 1) {
    return notes[0];
  }

  return undefined;
}

async function findNotesAndPickRelinkMatch(
  client: AnkiConnectClient,
  query: string,
  frontHtml: string,
  deck: string,
): Promise<NoteInfo | undefined> {
  const noteIds = await client.findNotes(query);
  if (noteIds.length === 0) {
    return undefined;
  }

  const notes = await client.notesInfo(noteIds);
  return pickSingleRelinkMatch(notes, frontHtml, deck);
}

async function findNoteByHeadingTagInDeck(
  client: AnkiConnectClient,
  deck: string,
  headingTag: string,
  frontHtml: string,
): Promise<NoteInfo | undefined> {
  for (const query of buildHeadingTagSearchQueries(deck, headingTag)) {
    const match = await findNotesAndPickRelinkMatch(
      client,
      query,
      frontHtml,
      deck,
    );
    if (match) {
      return match;
    }
  }

  return undefined;
}

async function findNoteByKeywordsInDeck(
  client: AnkiConnectClient,
  deck: string,
  frontHtml: string,
): Promise<NoteInfo | undefined> {
  for (const query of buildKeywordSearchQueries(deck, frontHtml)) {
    const match = await findNotesAndPickRelinkMatch(
      client,
      query,
      frontHtml,
      deck,
    );
    if (match) {
      return match;
    }
  }

  return undefined;
}

export async function resolveExistingNoteForRelink(
  client: AnkiConnectClient,
  payload: RelinkPayload,
  cache?: Map<string, NoteInfo | undefined>,
): Promise<NoteInfo | undefined> {
  const cacheKey = `${payload.deck}\0relink\0${payload.tag}\0${payload.frontHtml}`;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const byFront = await findNoteByFrontInDeck(
    client,
    payload.deck,
    payload.frontHtml,
    cache,
  );
  if (byFront) {
    cache?.set(cacheKey, byFront);
    return byFront;
  }

  const byHeadingTag = await findNoteByHeadingTagInDeck(
    client,
    payload.deck,
    payload.tag,
    payload.frontHtml,
  );
  if (byHeadingTag) {
    cache?.set(cacheKey, byHeadingTag);
    return byHeadingTag;
  }

  const byKeywords = await findNoteByKeywordsInDeck(
    client,
    payload.deck,
    payload.frontHtml,
  );
  if (byKeywords) {
    cache?.set(cacheKey, byKeywords);
    return byKeywords;
  }

  return undefined;
}
