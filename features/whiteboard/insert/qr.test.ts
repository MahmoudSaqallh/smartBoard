import { describe, expect, it } from "vitest";
import { QR_MAX_LENGTH } from "../constants";
import { encodeQr, looksLikeUrl, qrPathData, validateQrContent } from "./qr";

describe("QR content", () => {
  it("rejects empty and overly long content", () => {
    expect(validateQrContent("   ")).toMatch(/Enter/);
    expect(validateQrContent("x".repeat(QR_MAX_LENGTH + 1))).toMatch(/under/);
    expect(encodeQr("").ok).toBe(false);
  });

  it("encodes any text, including strings that are not valid URLs", () => {
    for (const content of ["https://example.com/lesson/4", "Homework: page 12", "not a url :// at all", "مرحبا"]) {
      const result = encodeQr(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.modules).toHaveLength(result.count);
        expect(result.modules.every((row) => row.length === result.count)).toBe(true);
      }
    }
  });

  it("builds an SVG path covering exactly the dark modules", () => {
    expect(qrPathData([[true, true, false], [false, true, false]])).toBe("M0 0h2v1h-2zM1 1h1v1h-1z");
  });

  it("only flags http(s) links, never script URLs", () => {
    expect(looksLikeUrl("https://example.com")).toBe(true);
    expect(looksLikeUrl("javascript:alert(1)")).toBe(false);
    expect(looksLikeUrl("example.com")).toBe(false);
  });
});
