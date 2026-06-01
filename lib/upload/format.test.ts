import { describe, it, expect } from "vitest";
import { formatSize } from "./client";

describe("formatSize", () => {
  it("formats bytes as KB/MB strings", () => {
    expect(formatSize(512)).toBe("512 Б");
    expect(formatSize(2048)).toBe("2.0 КБ");
    expect(formatSize(5 * 1024 * 1024)).toBe("5.0 МБ");
  });
});
