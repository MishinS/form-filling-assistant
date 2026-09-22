import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { resolveEd, validateEd, MAX_SKELETON_LENGTH, type EdDefaults } from "./ed-custom";
import { MAX_INSTRUCTION_LENGTH } from "./note";
import { ED_FIELDS, ED_INSTRUCTION } from "@/lib/render/ed";
import type { ExtractField } from "@/lib/extract/fields";

const skeleton = readFileSync(path.join(process.cwd(), "lib/render/templates/ed.html"), "utf8");
const defaults: EdDefaults = { fields: ED_FIELDS, instruction: ED_INSTRUCTION, skeleton };
const byId = (fs: ExtractField[], id: string) => fs.find((f) => f.id === id)!;
/** Каталожное поле без разметки — в таком виде оно приходит из тела запроса. */
const stripped = (f: ExtractField): ExtractField => ({ ...f, paragraphHtml: undefined, listSeparator: undefined });

describe("resolveEd", () => {
  it("no row → every layer is the repository default", () => {
    const eff = resolveEd(null, defaults);
    expect(eff.fields).toEqual(ED_FIELDS);
    expect(eff.instruction).toBe(ED_INSTRUCTION);
    expect(eff.skeleton).toBe(skeleton);
    expect(eff.custom).toEqual({ fields: false, instruction: false, skeleton: false });
  });

  it("only the instruction saved → the rest follows the defaults", () => {
    const eff = resolveEd({ fields: null, instruction: "своя инструкция", skeleton: null }, defaults);
    expect(eff.instruction).toBe("своя инструкция");
    expect(eff.fields).toEqual(ED_FIELDS);
    expect(eff.skeleton).toBe(skeleton);
    expect(eff.custom).toEqual({ fields: false, instruction: true, skeleton: false });
  });

  it("a catalog field keeps its markup from the catalog; a user field gets none", () => {
    const user: ExtractField = { id: "u1", group: "terms", cell: "delivery", label_ru: "Доставка", label_en: "Delivery",
      kind: "text", required: false, strategy: "llm", slotMode: "paragraphs", paragraphHtml: "<p><b>{}</b></p>" };
    const eff = resolveEd({ fields: [...ED_FIELDS.map(stripped), user], instruction: null, skeleton: null }, defaults);
    expect(byId(eff.fields, "e5").paragraphHtml).toBe(byId(ED_FIELDS, "e5").paragraphHtml);
    expect(byId(eff.fields, "e1").listSeparator).toBe(byId(ED_FIELDS, "e1").listSeparator);
    expect(byId(eff.fields, "u1").paragraphHtml).toBeUndefined();
    expect(eff.custom.fields).toBe(true);
  });
});

describe("validateEd", () => {
  const eff = (over: Partial<EdDefaults>) => ({ ...defaults, ...over });

  it("the repository template is valid", () => {
    expect(validateEd(eff({}))).toEqual({ ok: true });
  });

  it("a slot no field addresses is named", () => {
    const sk = skeleton + "<p><!--slot:delivery--></p>";
    expect(validateEd(eff({ skeleton: sk }))).toEqual({ ok: false, error: { code: "unaddressed_slot", slot: "delivery" } });
  });

  it("a field whose slot is gone from the skeleton is named", () => {
    const sk = skeleton.replace("<!--slot:penalties-->", "");
    expect(validateEd(eff({ skeleton: sk }))).toEqual({ ok: false, error: { code: "unknown_slot", fieldId: "e7" } });
  });

  it("a field without a slot is named", () => {
    const fields = [...ED_FIELDS, { ...ED_FIELDS[1], id: "u1", cell: "" }];
    expect(validateEd(eff({ fields }))).toEqual({ ok: false, error: { code: "unknown_slot", fieldId: "u1" } });
  });

  it("a duplicated slot is named", () => {
    const sk = skeleton + "<p><!--slot:subject--></p>";
    expect(validateEd(eff({ skeleton: sk }))).toEqual({ ok: false, error: { code: "duplicate_slot", slot: "subject" } });
  });

  it("two fields with one id are refused", () => {
    const fields = [...ED_FIELDS, { ...ED_FIELDS[1], cell: "subject2" }];
    const sk = skeleton + "<p><!--slot:subject2--></p>";
    expect(validateEd(eff({ fields, skeleton: sk }))).toEqual({ ok: false, error: { code: "duplicate_field", fieldId: "e2" } });
  });

  it("an id attribute, a foreign tag or a font size the editor lacks are refused", () => {
    for (const bad of ['<p id="x">a</p>', "<script>x</script>", '<span style="font-size: 16px;">a</span>']) {
      const r = validateEd(eff({ skeleton: skeleton + bad }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("subset");
    }
  });

  it("a link that is not http(s), mailto, tel or an anchor is refused", () => {
    const r = validateEd(eff({ skeleton: skeleton + '<a href="javascript:alert(1)">x</a>' }));
    expect(r).toEqual({ ok: false, error: { code: "unsafe_href", href: "javascript:alert(1)" } });
    expect(validateEd(eff({ skeleton: skeleton + '<a href="https://navi.example/doc">x</a>' }))).toEqual({ ok: true });
  });

  it("an instruction over the bound is refused", () => {
    const r = validateEd(eff({ instruction: "x".repeat(MAX_INSTRUCTION_LENGTH + 1) }));
    expect(r).toEqual({ ok: false, error: { code: "instruction_too_long" } });
  });

  it("a skeleton over the bound is refused", () => {
    const r = validateEd(eff({ skeleton: skeleton + " ".repeat(MAX_SKELETON_LENGTH) }));
    expect(r).toEqual({ ok: false, error: { code: "skeleton_too_long" } });
  });
});
