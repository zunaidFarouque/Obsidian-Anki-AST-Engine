import { readFile } from "node:fs/promises";
import pLimit from "p-limit";
import type { MediaUploadPlan } from "../ast/mediaResolver";
import type { AnkiConnectClient } from "./client";

const MIN_UPLOAD_BYTES = 1000;

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
  const uniquePlans = dedupePlans(plans);

  await Promise.all(
    uniquePlans.map((plan) =>
      limit(async () => {
        const buffer = await readFile(plan.absolutePath);
        if (buffer.length < MIN_UPLOAD_BYTES) {
          throw new Error(
            `Refusing to upload empty fixture media ${plan.fileName} (${buffer.length} bytes at ${plan.absolutePath}). Run: bun run setup:fixtures`,
          );
        }

        const data = buffer.toString("base64");
        await client.storeMediaFile(plan.fileName, data);
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
