import { writeFile } from "node:fs/promises";
import { resolve as nodeResolve } from "node:path";
import { runExclusive } from "../utils/mutexMap";
import type { ExtractedCard } from "../parser/stateMachine";
import type { VaultAdapter } from "./vaultAdapter";

export type InjectionPlan = {
  offset: number;
  uuid: string;
};

export function isOffsetInsideHtmlComment(
  rawText: string,
  offset: number,
): boolean {
  let searchFrom = 0;

  while (searchFrom < rawText.length) {
    const open = rawText.indexOf("<!--", searchFrom);
    if (open === -1) {
      return false;
    }

    const close = rawText.indexOf("-->", open + 4);
    if (close === -1) {
      return false;
    }

    const commentEnd = close + 3;
    if (offset > open && offset < commentEnd) {
      return true;
    }

    searchFrom = commentEnd;
  }

  return false;
}

export function mergeInjectionMetadata(
  graftedCards: ExtractedCard[],
  sourceCards: ExtractedCard[],
): ExtractedCard[] {
  if (graftedCards.length !== sourceCards.length) {
    throw new Error(
      `Card count mismatch after grafting (${sourceCards.length} source vs ${graftedCards.length} grafted)`,
    );
  }

  return graftedCards.map((card, index) => {
    const source = sourceCards[index]!;
    return {
      ...card,
      ankiId: source.ankiId,
      injectionOffset: source.injectionOffset,
    };
  });
}

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
    uuid: crypto.randomUUID(),
  };
}

export async function injectIdIntoFile(
  filePath: string,
  rawText: string,
  offset: number,
  uuid: string,
  vault?: VaultAdapter,
): Promise<string> {
  return batchInjectIdsIntoFile(filePath, rawText, [{ offset, uuid }], vault);
}

export async function batchInjectIdsIntoFile(
  filePath: string,
  rawText: string,
  injections: Array<{ offset: number; uuid: string }>,
  vault?: VaultAdapter,
): Promise<string> {
  if (injections.length === 0) {
    return rawText;
  }

  const lockKey = vault ? `${vault.vaultRoot}:${filePath}` : filePath;

  return runExclusive(lockKey, async () => {
    let updated = rawText;
    const sorted = [...injections].sort((a, b) => b.offset - a.offset);

    for (const injection of sorted) {
      if (isOffsetInsideHtmlComment(rawText, injection.offset)) {
        throw new Error(
          `Refusing to inject anki-id inside HTML comment at offset ${injection.offset}`,
        );
      }
      updated = spliceIdAtOffset(updated, injection.offset, injection.uuid);
    }

    if (vault) {
      await vault.writeText(filePath, updated);
    } else {
      await writeFile(nodeResolve(filePath), updated, "utf8");
    }

    return updated;
  });
}
