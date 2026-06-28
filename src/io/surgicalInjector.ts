import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { runExclusive } from "../utils/mutexMap";
import type { ExtractedCard } from "../parser/stateMachine";

export type InjectionPlan = {
  offset: number;
  uuid: string;
};

export function spliceIdAtOffset(
  rawText: string,
  offset: number,
  uuid: string,
): string {
  const injection = `\n<!--anki-id: ${uuid}-->\n`;
  return rawText.slice(0, offset) + injection + rawText.slice(offset);
}

export function buildInjectionPlan(card: ExtractedCard): InjectionPlan | undefined {
  if (card.ankiId || card.injectionOffset === undefined) {
    return undefined;
  }

  return {
    offset: card.injectionOffset,
    uuid: randomUUID(),
  };
}

export async function injectIdIntoFile(
  absolutePath: string,
  rawText: string,
  offset: number,
  uuid: string,
): Promise<string> {
  return runExclusive(absolutePath, async () => {
    const updated = spliceIdAtOffset(rawText, offset, uuid);
    await writeFile(absolutePath, updated, "utf8");
    return updated;
  });
}
