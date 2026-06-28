import { readFile } from "node:fs/promises";
import pLimit from "p-limit";
import type { MediaUploadPlan } from "../ast/mediaResolver";
import type { AnkiConnectClient } from "./client";

const dryRunQueue: MediaUploadPlan[] = [];

export function enqueueMediaDryRun(plan: MediaUploadPlan): void {
  if (!dryRunQueue.some((entry) => entry.absolutePath === plan.absolutePath)) {
    dryRunQueue.push(plan);
  }
}

export function drainMediaDryRunQueue(): MediaUploadPlan[] {
  const queued = [...dryRunQueue];
  dryRunQueue.length = 0;
  return queued;
}

export function getMediaDryRunQueue(): MediaUploadPlan[] {
  return [...dryRunQueue];
}

export function clearMediaDryRunQueue(): void {
  dryRunQueue.length = 0;
}

export type UploadMediaOptions = {
  concurrency?: number;
};

export async function uploadMediaPlans(
  plans: MediaUploadPlan[],
  client: AnkiConnectClient,
  options: UploadMediaOptions = {},
): Promise<void> {
  if (plans.length === 0) {
    return;
  }

  const limit = pLimit(options.concurrency ?? 3);
  const existing = new Set(await client.mediaFiles());
  const uniquePlans = dedupePlans(plans);

  await Promise.all(
    uniquePlans.map((plan) =>
      limit(async () => {
        if (existing.has(plan.fileName)) {
          return;
        }

        const buffer = await readFile(plan.absolutePath);
        const data = buffer.toString("base64");
        await client.storeMediaFile(plan.fileName, data);
        existing.add(plan.fileName);
      }),
    ),
  );
}

function dedupePlans(plans: MediaUploadPlan[]): MediaUploadPlan[] {
  const seen = new Set<string>();
  const unique: MediaUploadPlan[] = [];

  for (const plan of plans) {
    if (seen.has(plan.fileName)) {
      continue;
    }
    seen.add(plan.fileName);
    unique.push(plan);
  }

  return unique;
}
