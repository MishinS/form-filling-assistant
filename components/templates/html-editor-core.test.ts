import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { reduce, EMPTY_DRAFT, placeholders, insertAt, slotToken, errorKey, previewHtml, saveBody, type Draft } from "./html-editor-core";
import { ED_FIELDS, ED_INSTRUCTION } from "@/lib/render/ed";
import type { EdDefaults } from "@/lib/templates/ed-custom";

const skeleton = readFileSync(path.join(process.cwd(), "lib/render/templates/ed.html"), "utf8");
const defaults: EdDefaults = { fields: ED_FIELDS, instruction: ED_INSTRUCTION, skeleton };
const labels = { ru: "Новое поле", en: "New field" };
const run = (d: Draft, ...as: Parameters<typeof reduce>[1][]) => as.reduce((acc, a) => reduce(acc, a, defaults, labels), d);

describe("reduce", () => {
  it("editing a field starts from the defaults and marks only the fields layer", () => {
    const d = run(EMPTY_DRAFT, { type: "field", id: "e7", patch: { label_ru: "Неустойка" } });
    expect(d.fields!.find(f => f.id === "e7")!.label_ru).toBe("Неустойка");
    expect(d.fields).toHaveLength(ED_FIELDS.length);
    expect(d.instruction).toBeNull();
    expect(d.skeleton).toBeNull();
  });

  it("a new field gets a fresh u-id, addressed by a slot of the same name", () => {
    const d = run(EMPTY_DRAFT, { type: "addField" }, { type: "addField" });
    const added = d.fields!.slice(ED_FIELDS.length);
    expect(added.map(f => f.id)).toEqual(["u1", "u2"]);
    expect(added[0]).toMatchObject({ cell: "u1", label_ru: "Новое поле", label_en: "New field", strategy: "llm", slotMode: "text" });
  });

  it("deleting a field removes it", () => {
    const d = run(EMPTY_DRAFT, { type: "deleteField", id: "e9" });
    expect(d.fields!.some(f => f.id === "e9")).toBe(false);
  });

  it("instruction and skeleton are set as typed", () => {
    const d = run(EMPTY_DRAFT, { type: "instruction", value: "своя" }, { type: "skeleton", value: "<p></p>" });
    expect(d).toEqual({ fields: null, instruction: "своя", skeleton: "<p></p>" });
  });

  it("resetting a layer returns only that layer to the default", () => {
    const d = run(EMPTY_DRAFT, { type: "instruction", value: "своя" }, { type: "skeleton", value: "<p></p>" },
      { type: "resetLayer", layer: "skeleton" });
    expect(d).toEqual({ fields: null, instruction: "своя", skeleton: null });
  });
});

describe("preview", () => {
  it("every field shows as its label in brackets", () => {
    const vals = placeholders(ED_FIELDS);
    expect(vals.find(v => v.fieldId === "e2")!.value).toBe(`[${ED_FIELDS[1].label_ru}]`);
  });

  it("the draft renders with placeholders, or reports why it cannot", () => {
    const ok = previewHtml(EMPTY_DRAFT, defaults);
    expect(ok.ok && ok.html).toContain("[Предмет заказа/договора");
    const bad = previewHtml({ ...EMPTY_DRAFT, skeleton: skeleton + "<p><!--slot:x--></p>" }, defaults);
    expect(bad).toEqual({ ok: false, error: { code: "unaddressed_slot", slot: "x" } });
  });
});

describe("slot helper", () => {
  it("inserts the token at the cursor and moves the cursor past it", () => {
    expect(slotToken("u1")).toBe("<!--slot:u1-->");
    expect(insertAt("<p></p>", 3, slotToken("u1"))).toEqual({ text: "<p><!--slot:u1--></p>", cursor: 17 });
  });
});

describe("errorKey", () => {
  it("maps each error to an i18n key and the name it points at", () => {
    expect(errorKey({ code: "unaddressed_slot", slot: "x" })).toEqual({ key: "ed_err_unaddressed_slot", name: "x" });
    expect(errorKey({ code: "subset", error: { code: "tag_not_allowed", tag: "script" } })).toEqual({ key: "ed_err_subset", name: "script" });
    expect(errorKey({ code: "instruction_too_long" })).toEqual({ key: "ed_err_instruction_too_long", name: "" });
  });
});

describe("saveBody", () => {
  it("sends every layer, null meaning the default", () => {
    expect(saveBody({ fields: null, instruction: "x", skeleton: null }))
      .toEqual({ templateId: "ed", fields: null, instruction: "x", skeleton: null });
  });
});
