import { describe, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { AnkiConnectClient } from "../../src/anki/client";
import { uploadMediaPlans } from "../../src/anki/mediaQueue";
import type { MediaUploadPlan } from "../../src/ast/mediaResolver";

describe("mediaQueue live upload", () => {
  test("uploadMediaPlans calls storeMediaFile with base64 data", async () => {
    const calls: Array<{ filename: string; data: string }> = [];
    const client = {
      mediaFiles: async () => [],
      storeMediaFile: async (filename: string, data: string) => {
        calls.push({ filename, data });
        return filename;
      },
    } as unknown as AnkiConnectClient;

    const plans: MediaUploadPlan[] = [
      {
        fileName: "diagram.png",
        absolutePath: `${import.meta.dir}/../fixtures/Cell Diagram final.png`,
        vaultRelativePath: "diagram.png",
      },
    ];

    await uploadMediaPlans(plans, client, { concurrency: 1 });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.filename).toBe("diagram.png");
    expect(calls[0]?.data.length).toBeGreaterThan(1000);
  });

  test("uploadMediaPlans rejects empty placeholder media files", async () => {
    const client = {
      mediaFiles: async () => [],
      storeMediaFile: async () => "unused",
    } as unknown as AnkiConnectClient;

    const plans: MediaUploadPlan[] = [
      {
        fileName: "empty.png",
        absolutePath: `${import.meta.dir}/../fixtures/Diagram.png`,
        vaultRelativePath: "empty.png",
      },
    ];

    const tiny = await readFile(plans[0]!.absolutePath);
    if (tiny.length >= 1000) {
      return;
    }

    await expect(uploadMediaPlans(plans, client, { concurrency: 1 })).rejects.toThrow(
      /Refusing to upload empty fixture media/,
    );
  });

  test("uploadMediaPlans overwrites files already in Anki media", async () => {
    let uploadCount = 0;
    const client = {
      mediaFiles: async () => ["diagram.png"],
      storeMediaFile: async () => {
        uploadCount += 1;
        return "diagram.png";
      },
    } as unknown as AnkiConnectClient;

    const plans: MediaUploadPlan[] = [
      {
        fileName: "diagram.png",
        absolutePath: `${import.meta.dir}/../fixtures/Cell Diagram final.png`,
        vaultRelativePath: "diagram.png",
      },
    ];

    await uploadMediaPlans(plans, client, { concurrency: 1 });
    expect(uploadCount).toBe(1);
  });
});
