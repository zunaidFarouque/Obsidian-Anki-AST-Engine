import { describe, expect, test } from "bun:test";
import type { Image } from "mdast";
import { createResolvedMediaNode } from "../../src/ast/vaultMediaNodes";

describe("createResolvedMediaNode", () => {
  test("creates image node for raster and svg", () => {
    const raster = createResolvedMediaNode("rasterImage", "photo.png", "Alt");
    expect(raster.type).toBe("image");
    expect((raster as Image).url).toBe("photo.png");
    expect((raster as Image).alt).toBe("Alt");

    const svg = createResolvedMediaNode("svg", "icon.svg");
    expect(svg.type).toBe("image");
    expect((svg as Image).url).toBe("icon.svg");
    expect((svg as Image).alt).toBe("");
  });

  test("creates sound paragraph for audio and video", () => {
    const audio = createResolvedMediaNode("audio", "lecture.mp3");
    expect(audio.type).toBe("paragraph");
    expect(audio).toMatchObject({
      children: [{ type: "text", value: "[sound:lecture.mp3]" }],
    });

    const video = createResolvedMediaNode("video", "clip.mp4");
    expect(video).toMatchObject({
      children: [{ type: "text", value: "[sound:clip.mp4]" }],
    });
  });

  test("creates pdf link paragraph with display text", () => {
    const pdf = createResolvedMediaNode("pdf", "slides.pdf", "Lecture slides");
    expect(pdf.type).toBe("paragraph");
    expect(pdf).toMatchObject({
      children: [
        {
          type: "link",
          url: "slides.pdf",
          children: [{ type: "text", value: "Lecture slides" }],
        },
      ],
    });

    const defaultLabel = createResolvedMediaNode("pdf", "slides.pdf");
    expect(defaultLabel).toMatchObject({
      children: [
        {
          type: "link",
          url: "slides.pdf",
          children: [{ type: "text", value: "slides.pdf" }],
        },
      ],
    });
  });
});
