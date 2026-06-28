import { readFile, stat } from "node:fs/promises";
import pLimit from "p-limit";
import type { MediaUploadPlan } from "../ast/mediaResolver";
import type { AnkiConnectClient } from "./client";
import type { VaultAdapter } from "../io/vaultAdapter";

const MIN_UPLOAD_BYTES = 1000;

const dryRunQueue: MediaUploadPlan[] = [];

function planQueueKey(plan: MediaUploadPlan): string {
  return plan.absolutePath ?? plan.sourceUrl ?? plan.fileName;
}

export function enqueueMediaDryRun(plan: MediaUploadPlan): void {
  const key = planQueueKey(plan);
  if (!dryRunQueue.some((entry) => planQueueKey(entry) === key)) {
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
  vault?: VaultAdapter;
  forceBase64Media?: boolean;
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
        await uploadSinglePlan(plan, client, options);
      }),
    ),
  );
}

async function readPlanBytes(
  plan: MediaUploadPlan,
  vault?: VaultAdapter,
): Promise<Uint8Array> {
  if (vault && plan.vaultRelativePath) {
    return vault.readBytes(plan.vaultRelativePath);
  }

  if (!plan.absolutePath) {
    throw new Error(`Media plan missing path for ${plan.fileName}`);
  }

  const buffer = await readFile(plan.absolutePath);
  return new Uint8Array(buffer);
}

async function statPlanFile(
  plan: MediaUploadPlan,
  vault?: VaultAdapter,
): Promise<{ size: number; isFile: boolean }> {
  if (vault && plan.vaultRelativePath) {
    return vault.stat(plan.vaultRelativePath);
  }

  if (!plan.absolutePath) {
    throw new Error(`Media plan missing path for ${plan.fileName}`);
  }

  const fileStat = await stat(plan.absolutePath);
  return {
    size: fileStat.size,
    isFile: fileStat.isFile(),
  };
}

function bytesToBase64(buffer: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }

  let binary = "";
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function uploadSinglePlan(
  plan: MediaUploadPlan,
  client: AnkiConnectClient,
  options: UploadMediaOptions,
): Promise<void> {
  if (plan.transport === "url") {
    if (!plan.sourceUrl) {
      throw new Error(`URL media plan missing sourceUrl for ${plan.fileName}`);
    }

    await client.storeMediaFile({
      filename: plan.fileName,
      url: plan.sourceUrl,
    });
    return;
  }

  const buffer = await readPlanBytes(plan, options.vault);
  await assertValidMediaBuffer(plan, buffer);

  if (plan.transport === "base64" || options.forceBase64Media) {
    await client.storeMediaFile({
      filename: plan.fileName,
      data: bytesToBase64(buffer),
    });
    return;
  }

  if (!plan.absolutePath) {
    throw new Error(`Path media plan missing absolutePath for ${plan.fileName}`);
  }

  const fileStat = await statPlanFile(plan, options.vault);
  if (!fileStat.isFile) {
    throw new Error(`Media file not found: ${plan.absolutePath}`);
  }

  if (fileStat.size < MIN_UPLOAD_BYTES) {
    throw new Error(
      `Refusing to upload empty fixture media ${plan.fileName} (${fileStat.size} bytes at ${plan.absolutePath}). Run: bun run setup:fixtures`,
    );
  }

  try {
    await client.storeMediaFile({
      filename: plan.fileName,
      path: plan.absolutePath,
    });
  } catch (pathError) {
    try {
      await client.storeMediaFile({
        filename: plan.fileName,
        data: bytesToBase64(buffer),
      });
    } catch (base64Error) {
      const pathMessage =
        pathError instanceof Error ? pathError.message : String(pathError);
      const base64Message =
        base64Error instanceof Error ? base64Error.message : String(base64Error);
      throw new Error(
        `Failed to upload ${plan.fileName} via path (${pathMessage}) and base64 (${base64Message})`,
      );
    }
  }
}

async function assertValidMediaBuffer(
  plan: MediaUploadPlan,
  buffer: Uint8Array,
): Promise<void> {
  if (buffer.length < MIN_UPLOAD_BYTES) {
    throw new Error(
      `Refusing to upload empty fixture media ${plan.fileName} (${buffer.length} bytes at ${plan.absolutePath ?? plan.sourceUrl}). Run: bun run setup:fixtures`,
    );
  }
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
