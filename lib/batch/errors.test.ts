import { describe,it,expect } from "vitest";
import { translate } from "@/lib/i18n";
import { BATCH_ERROR_CODES,batchError,decodeBatchError,formatBatchError } from "./errors";

describe("batchError / decodeBatchError", () => {

  it("round-trips every known code", () => {
    for (const code of BATCH_ERROR_CODES) {
      expect(decodeBatchError(batchError(code).message)).toEqual({ code });
      expect(decodeBatchError(batchError(code, 500).message)).toEqual({ code, status: 500 });
    }
  });
});

describe("formatBatchError", () => {
  const ru = (k: string) => translate(k, "ru");
  const en = (k: string) => translate(k, "en");

  it("falls back to the generic label instead of echoing unknown payloads", () => {
    const raw = "<html><body>502 Bad Gateway — nginx</body></html>";
    expect(formatBatchError(raw, ru)).toBe("Ошибка");
    expect(formatBatchError(raw, en)).toBe("Failed");
    expect(formatBatchError('{"error":"boom"}', en)).toBe("Failed");
    expect(formatBatchError(undefined, en)).toBe("Failed");
    expect(formatBatchError("", en)).toBe("Failed");
  });
});
