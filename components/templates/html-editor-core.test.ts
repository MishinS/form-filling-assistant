import { readFileSync } from "node:fs";
import path from "node:path";
import { describe,it,expect } from "vitest";
import { reduce,EMPTY_DRAFT,previewHtml,type Draft } from "./html-editor-core";
import { ED_FIELDS,ED_INSTRUCTION } from "@/lib/render/ed";
import type { EdDefaults } from "@/lib/templates/ed-custom";

const skeleton = readFileSync(path.join(process.cwd(), "lib/render/templates/ed.html"), "utf8");
const defaults: EdDefaults = { fields: ED_FIELDS, instruction: ED_INSTRUCTION, skeleton };
const labels = { ru: "Новое поле", en: "New field" };
const run = (d: Draft, ...as: Parameters<typeof reduce>[1][]) => as.reduce((acc, a) => reduce(acc, a, defaults, labels), d);

describe("reduce", () => {

  it("resetting a layer returns only that layer to the default", () => {
    const d = run(EMPTY_DRAFT, { type: "instruction", value: "своя" }, { type: "skeleton", value: "<p></p>" },
      { type: "resetLayer", layer: "skeleton" });
    expect(d).toEqual({ fields: null, instruction: "своя", skeleton: null });
  });
});

describe("preview", () => {

  it("the draft renders with placeholders, or reports why it cannot", () => {
    const ok = previewHtml(EMPTY_DRAFT, defaults);
    expect(ok.ok && ok.html).toContain("[Предмет заказа/договора");
    const bad = previewHtml({ ...EMPTY_DRAFT, skeleton: skeleton + "<p><!--slot:x--></p>" }, defaults);
    expect(bad).toEqual({ ok: false, error: { code: "unaddressed_slot", slot: "x" } });
  });
});
