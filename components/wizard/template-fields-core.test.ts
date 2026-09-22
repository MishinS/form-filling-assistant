import { describe,it,expect } from "vitest";
import { wizardTemplate } from "./template-fields-core";
import { ED_FIELDS,ED_INSTRUCTION } from "@/lib/render/ed";
import { PT_FIELDS } from "@/lib/extract/fields";

const mine = { fields: ED_FIELDS.slice(0, 3), instruction: "моя инструкция" };
const base = { guest: false, ptFields: PT_FIELDS, customFields: {}, edConfig: undefined };

describe("wizardTemplate", () => {
  it("a registered user's passport is the fetched one, fields and instruction", () => {
    expect(wizardTemplate("ed", { ...base, edConfig: mine })).toEqual({ ...mine, needsFetch: false });
  });

  it("a guest gets the repository passport and never fetches", () => {
    expect(wizardTemplate("ed", { ...base, guest: true, edConfig: mine }))
      .toEqual({ fields: ED_FIELDS, instruction: ED_INSTRUCTION, needsFetch: false });
  });
});
