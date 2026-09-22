import { describe, it, expect } from "vitest";
import { wizardTemplate, parseEdConfig } from "./template-fields-core";
import { ED_FIELDS, ED_INSTRUCTION } from "@/lib/render/ed";
import { PT_FIELDS, PT_INSTRUCTION } from "@/lib/extract/fields";

const mine = { fields: ED_FIELDS.slice(0, 3), instruction: "моя инструкция" };
const base = { guest: false, ptFields: PT_FIELDS, customFields: {}, edConfig: undefined };

describe("wizardTemplate", () => {
  it("a registered user's passport is the fetched one, fields and instruction", () => {
    expect(wizardTemplate("ed", { ...base, edConfig: mine })).toEqual({ ...mine, needsFetch: false });
  });

  it("before the fetch lands there are no fields yet, and a fetch is needed", () => {
    expect(wizardTemplate("ed", base)).toEqual({ fields: [], instruction: undefined, needsFetch: true });
  });

  it("a guest gets the repository passport and never fetches", () => {
    expect(wizardTemplate("ed", { ...base, guest: true, edConfig: mine }))
      .toEqual({ fields: ED_FIELDS, instruction: ED_INSTRUCTION, needsFetch: false });
  });

  it("PT keeps the mapping from context and its own instruction", () => {
    expect(wizardTemplate("pt", base)).toEqual({ fields: PT_FIELDS, instruction: PT_INSTRUCTION, needsFetch: false });
  });

  it("a custom template has no instruction and fetches its fields once", () => {
    expect(wizardTemplate("tpl-1", base)).toEqual({ fields: [], instruction: undefined, needsFetch: true });
    expect(wizardTemplate("tpl-1", { ...base, customFields: { "tpl-1": PT_FIELDS } }))
      .toEqual({ fields: PT_FIELDS, instruction: undefined, needsFetch: false });
  });
});

describe("parseEdConfig", () => {
  it("takes fields and instruction from the mappings response", () => {
    expect(parseEdConfig({ ...mine, skeleton: "<p></p>", custom: {} })).toEqual(mine);
  });
  it("anything else is no config", () => {
    expect(parseEdConfig({ error: "x" })).toBeNull();
    expect(parseEdConfig(null)).toBeNull();
  });
});
