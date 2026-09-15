import { describe, it, expect } from "vitest";
import { validateSlotRef } from "./slotref";

const SLOTS = ["d0", "subject", "expenseClass", "startedBy"];

describe("validateSlotRef", () => {
  it("accepts a slot the skeleton declares", () => {
    expect(validateSlotRef("subject", SLOTS)).toEqual({ ok: true, normalized: "subject" });
  });

  it("trims surrounding space", () => {
    expect(validateSlotRef("  d0 ", SLOTS)).toEqual({ ok: true, normalized: "d0" });
  });

  it("rejects an empty address", () => {
    expect(validateSlotRef("", SLOTS)).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects a slot the skeleton does not declare", () => {
    expect(validateSlotRef("nope", SLOTS)).toEqual({ ok: false, reason: "unknown" });
  });

  it("rejects a spreadsheet cell reference — that address belongs to another format", () => {
    expect(validateSlotRef("ПТ!D9", SLOTS)).toEqual({ ok: false, reason: "format" });
  });

  it("rejects anything that could carry markup or a path", () => {
    for (const bad of ["<b>", "a/b", "a b", "a.b", "a".repeat(65)]) {
      expect(validateSlotRef(bad, SLOTS)).toEqual({ ok: false, reason: "format" });
    }
  });

  it("rejects every slot when the skeleton declares none", () => {
    expect(validateSlotRef("subject", [])).toEqual({ ok: false, reason: "unknown" });
  });
});
