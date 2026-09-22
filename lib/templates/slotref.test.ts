import { describe, it, expect } from "vitest";
import { validateSlotRef } from "./slotref";

const SLOTS = ["d0", "subject", "expenseClass", "startedBy"];

describe("validateSlotRef", () => {

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
});
