import { describe, it, expect } from "vitest";
import { STR } from "@/lib/seed/pt";
import { translate } from "@/lib/i18n";
import { BATCH_ERROR_CODES, batchError, decodeBatchError, formatBatchError } from "./errors";

describe("batchError / decodeBatchError", () => {
  it("round-trips a code with a status", () => {
    const e = batchError("fill_failed", 502);
    expect(e).toBeInstanceOf(Error);
    expect(decodeBatchError(e.message)).toEqual({ code: "fill_failed", status: 502 });
  });

  it("round-trips a code without a status", () => {
    expect(decodeBatchError(batchError("extract_empty").message)).toEqual({ code: "extract_empty" });
  });

  it("round-trips every known code", () => {
    for (const code of BATCH_ERROR_CODES) {
      expect(decodeBatchError(batchError(code).message)).toEqual({ code });
      expect(decodeBatchError(batchError(code, 500).message)).toEqual({ code, status: 500 });
    }
  });

  it("returns null for anything it does not recognise", () => {
    // Raw response bodies must never decode — that is what keeps them out of the UI.
    expect(decodeBatchError("<html><body>502 Bad Gateway</body></html>")).toBeNull();
    expect(decodeBatchError('{"error":"boom"}')).toBeNull();
    expect(decodeBatchError("")).toBeNull();
    expect(decodeBatchError("Не удалось обработать файл (500)")).toBeNull();
    expect(decodeBatchError("unknown_code")).toBeNull();
    expect(decodeBatchError("unknown_code:500")).toBeNull();
  });

  it("returns null when the status segment is not a number", () => {
    expect(decodeBatchError("parse_failed:abc")).toBeNull();
    expect(decodeBatchError("parse_failed:")).toBeNull();
    expect(decodeBatchError("parse_failed:500:1")).toBeNull();
  });

  it("has an RU and EN string for every code", () => {
    for (const code of BATCH_ERROR_CODES) {
      const s = STR[`batch_err_${code}`];
      expect(s, `missing batch_err_${code}`).toBeTruthy();
      expect(s.ru.length).toBeGreaterThan(0);
      expect(s.en.length).toBeGreaterThan(0);
    }
  });
});

describe("formatBatchError", () => {
  const ru = (k: string) => translate(k, "ru");
  const en = (k: string) => translate(k, "en");

  it("localises the message and appends the status", () => {
    expect(formatBatchError(batchError("fill_failed", 502).message, ru))
      .toBe("Не удалось заполнить шаблон (502)");
    expect(formatBatchError(batchError("fill_failed", 502).message, en))
      .toBe("Couldn't fill the template (502)");
  });

  it("omits the parenthesis when there is no status", () => {
    expect(formatBatchError(batchError("llm_failed").message, en))
      .toBe("The model couldn't extract the data");
  });

  it("resolves a real string for every code in both locales", () => {
    for (const code of BATCH_ERROR_CODES) {
      for (const t of [ru, en]) {
        const out = formatBatchError(batchError(code).message, t);
        expect(out).not.toBe(`batch_err_${code}`); // no raw key leaked
        expect(out).not.toBe(t("batch_failed"));
      }
    }
  });

  it("falls back to the generic label instead of echoing unknown payloads", () => {
    const raw = "<html><body>502 Bad Gateway — nginx</body></html>";
    expect(formatBatchError(raw, ru)).toBe("Ошибка");
    expect(formatBatchError(raw, en)).toBe("Failed");
    expect(formatBatchError('{"error":"boom"}', en)).toBe("Failed");
    expect(formatBatchError(undefined, en)).toBe("Failed");
    expect(formatBatchError("", en)).toBe("Failed");
  });
});
