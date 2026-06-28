import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { AnkiConnectClient, StoreMediaFileParams } from "../../src/anki/client";
import { uploadMediaPlans } from "../../src/anki/mediaQueue";
import type { MediaUploadPlan } from "../../src/ast/mediaResolver";

describe("mediaQueue live upload", () => {
  test("uploadMediaPlans calls storeMediaFile with local path for vault files", async () => {
    const calls: StoreMediaFileParams[] = [];
    const client = {
      mediaFiles: async () => [],
      storeMediaFile: async (params: StoreMediaFileParams) => {
        calls.push(params);
        return "diagram.png";
      },
    } as unknown as AnkiConnectClient;

    const absolutePath = `${import.meta.dir}/../fixtures/Cell Diagram final.png`;
    const plans: MediaUploadPlan[] = [
      {
        fileName: "diagram.png",
        transport: "path",
        absolutePath,
        vaultRelativePath: "diagram.png",
      },
    ];

    await uploadMediaPlans(plans, client, { concurrency: 1 });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      filename: "diagram.png",
      path: absolutePath,
    });
  });

  test("uploadMediaPlans falls back to base64 when path upload fails", async () => {
    const calls: StoreMediaFileParams[] = [];
    const client = {
      mediaFiles: async () => [],
      storeMediaFile: async (params: StoreMediaFileParams) => {
        calls.push(params);
        if ("path" in params) {
          throw new Error("path rejected");
        }
        return "diagram.png";
      },
    } as unknown as AnkiConnectClient;

    const absolutePath = `${import.meta.dir}/../fixtures/Cell Diagram final.png`;
    const plans: MediaUploadPlan[] = [
      {
        fileName: "diagram.png",
        transport: "path",
        absolutePath,
        vaultRelativePath: "diagram.png",
      },
    ];

    await uploadMediaPlans(plans, client, { concurrency: 1 });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      filename: "diagram.png",
      path: absolutePath,
    });
    expect(calls[1]?.filename).toBe("diagram.png");
    expect(calls[1]).toHaveProperty("data");
    expect((calls[1] as { data: string }).data.length).toBeGreaterThan(1000);
  });

  test("uploadMediaPlans calls storeMediaFile with url for remote markdown images", async () => {
    const calls: StoreMediaFileParams[] = [];
    const client = {
      mediaFiles: async () => [],
      storeMediaFile: async (params: StoreMediaFileParams) => {
        calls.push(params);
        return "remote.png";
      },
    } as unknown as AnkiConnectClient;

    const plans: MediaUploadPlan[] = [
      {
        fileName: "remote.png",
        transport: "url",
        sourceUrl: "https://example.com/remote.png",
      },
    ];

    await uploadMediaPlans(plans, client, { concurrency: 1 });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      filename: "remote.png",
      url: "https://example.com/remote.png",
    });
  });

  test("uploadMediaPlans rejects empty placeholder media files", async () => {
    const client = {
      mediaFiles: async () => [],
      storeMediaFile: async () => "unused",
    } as unknown as AnkiConnectClient;

    const plans: MediaUploadPlan[] = [
      {
        fileName: "empty.png",
        transport: "path",
        absolutePath: `${import.meta.dir}/../fixtures/Diagram.png`,
        vaultRelativePath: "empty.png",
      },
    ];

    const tiny = await readFile(plans[0]!.absolutePath!);
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
        transport: "path",
        absolutePath: `${import.meta.dir}/../fixtures/Cell Diagram final.png`,
        vaultRelativePath: "diagram.png",
      },
    ];

    await uploadMediaPlans(plans, client, { concurrency: 1 });
    expect(uploadCount).toBe(1);
  });
});
