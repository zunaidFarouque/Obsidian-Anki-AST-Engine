import type { MediaUploadPlan } from "../ast/mediaResolver";

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
