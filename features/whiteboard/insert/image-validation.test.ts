import { describe, expect, it } from "vitest";
import { MAX_SVG_BYTES, MAX_UPLOAD_BYTES } from "../constants";
import { checkUpload, fitWithin, sniffImageType } from "./image-validation";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("sniffImageType", () => {
  it("recognises raster formats by their magic numbers", () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("png");
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(sniffImageType(new Uint8Array([...text("RIFF"), 0, 0, 0, 0, ...text("WEBP")]))).toBe("webp");
  });

  it("recognises SVG with prolog, comments and doctype", () => {
    expect(sniffImageType(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("svg");
    expect(sniffImageType(text('﻿<?xml version="1.0"?>\n<!-- logo -->\n<!DOCTYPE svg>\n<svg width="10">'))).toBe("svg");
  });

  it("rejects spoofed and unsupported files regardless of their name or MIME type", () => {
    expect(sniffImageType(text("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(text("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(new Uint8Array([...text("RIFF"), 0, 0, 0, 0, ...text("WAVE")]))).toBeNull();
    expect(sniffImageType(bytes())).toBeNull();
  });
});

describe("checkUpload", () => {
  it("rejects empty, unknown and oversized files with readable messages", () => {
    expect(checkUpload(0, "png")).toMatchObject({ ok: false, error: expect.stringMatching(/empty/) });
    expect(checkUpload(100, null)).toMatchObject({ ok: false, error: expect.stringMatching(/PNG, JPG, WebP or SVG/) });
    expect(checkUpload(MAX_UPLOAD_BYTES + 1, "jpeg")).toMatchObject({ ok: false });
    expect(checkUpload(MAX_SVG_BYTES + 1, "svg")).toMatchObject({ ok: false });
  });

  it("accepts valid files", () => {
    expect(checkUpload(1024, "webp")).toEqual({ ok: true, kind: "webp" });
  });
});

describe("fitWithin", () => {
  it("downscales huge images keeping the aspect ratio, never upscaling", () => {
    expect(fitWithin(8000, 4000, 2560)).toEqual({ width: 2560, height: 1280 });
    expect(fitWithin(300, 200, 2560)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(0, 100, 2560)).toEqual({ width: 0, height: 0 });
  });
});
