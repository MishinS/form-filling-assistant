import { describe, it, expect } from "vitest";
import { renderHtml, type RenderFieldSpec } from "./html";

const f = (id: string, extra: Partial<RenderFieldSpec> = {}): RenderFieldSpec => ({
  id,
  cell: id,
  ...extra,
});

const v = (fieldId: string, value: string) => ({ fieldId, value });

describe("renderHtml — slots", () => {
  it("fills every slot from its field's value", () => {
    const skeleton = `<p>А: <!--slot:a--></p><p>Б: <!--slot:b--></p>`;
    const r = renderHtml(skeleton, [f("a"), f("b")], [v("a", "раз"), v("b", "два")]);
    expect(r).toEqual({ ok: true, html: `<p>А: раз</p><p>Б: два</p>` });
  });

  it("emits the section even when the value is empty", () => {
    const skeleton = `<td>Штрафы: <!--slot:a--></td>`;
    const r = renderHtml(skeleton, [f("a")], [v("a", "")]);
    expect(r).toEqual({ ok: true, html: `<td>Штрафы: </td>` });
  });

  it("renders a constant over an empty extracted value", () => {
    const fields = [f("a", { fillMode: "constant", constantValue: "Мишин С. С." })];
    const r = renderHtml(`<td>Запустил: <!--slot:a--></td>`, fields, [v("a", "")]);
    expect(r).toEqual({ ok: true, html: `<td>Запустил: Мишин С. С.</td>` });
  });

  it("falls back to the field's default when the documents said nothing", () => {
    const fields = [f("a", { defaultValue: "стандартные условия" })];
    const r = renderHtml(`<td>Штрафы: <!--slot:a--></td>`, fields, [v("a", "")]);
    expect(r).toEqual({ ok: true, html: `<td>Штрафы: стандартные условия</td>` });
  });

  it("refuses a field addressing a slot the skeleton lacks, with no partial document", () => {
    const r = renderHtml(`<p><!--slot:a--></p>`, [f("a"), f("b")], [v("a", "раз")]);
    expect(r).toEqual({ ok: false, error: { code: "unknown_slot", fieldId: "b" } });
  });
});

const html = (skeleton: string, fields: RenderFieldSpec[], values: Array<{ fieldId: string; value: string }>) => {
  const r = renderHtml(skeleton, fields, values);
  if (!r.ok) throw new Error(`render failed: ${JSON.stringify(r.error)}`);
  return r.html;
};

describe("renderHtml — values are escaped, never interpreted", () => {
  it("shows a script tag from a supplier document as characters", () => {
    const out = html(`<td><!--slot:a--></td>`, [f("a")], [v("a", `<script>alert(1)</script>`)]);
    expect(out).toBe(`<td>&lt;script&gt;alert(1)&lt;/script&gt;</td>`);
    expect(out).not.toContain("<script>");
  });

  it("emits no attribute from a value carrying one", () => {
    // The characters stay visible — that is the point. What must not survive is a
    // real attribute, which needs an unescaped quote to close the preceding one.
    const out = html(`<td><!--slot:a--></td>`, [f("a")], [v("a", `" onclick="alert(1)`)]);
    expect(out).not.toContain(`onclick="`);
    expect(out).toBe(`<td>&quot; onclick=&quot;alert(1)</td>`);
  });

  it("renders a javascript: URL in a contact value as plain text", () => {
    const fields = [f("a", { slotMode: "contact" })];
    const out = html(`<td><!--slot:a--></td>`, fields, [v("a", "javascript:alert(1)")]);
    expect(out).not.toContain("<a ");
    expect(out).toContain("javascript:alert(1)");
  });
});

describe("renderHtml — value modes", () => {
  it("splits a payment schedule into one paragraph per line", () => {
    const fields = [f("a", { slotMode: "paragraphs" })];
    const value = "746 125 руб.\nАванс 60% - 447 675 руб.\n2 платеж 20% - 149 225 руб.\n3 платеж 20% - 149 225 руб.";
    const out = html(`<td><!--slot:a--></td>`, fields, [v("a", value)]);
    expect(out.match(/<p>/g)).toHaveLength(4);
    expect(out).toContain("<p>Аванс 60% - 447 675 руб.</p>");
  });

  it("treats a dollar sign in a value as text, not as a replacement pattern", () => {
    const fields = [f("a", { slotMode: "paragraphs", paragraphHtml: "<p><b>{}</b></p>" })];
    const out = html(`<td><!--slot:a--></td>`, fields, [v("a", "$& $$ 100")]);
    // `$&` and `$$` are replacement patterns to String.replace — with a string
    // replacement they would drag the wrapper's own text into the document.
    expect(out).toBe("<td><p><b>$&amp; $$ 100</b></p></td>");
    expect(out).not.toContain("{}");
  });

  it("joins list items with the declared separator and leaves a trailing one", () => {
    const fields = [f("a", { slotMode: "list", listSeparator: "&nbsp;|" })];
    const out = html(`<p>Заказ&nbsp;|<!--slot:a--></p>`, fields, [v("a", "Договор №07_26\nСчёт №7\nСмета")]);
    expect(out).toBe(`<p>Заказ&nbsp;|Договор №07_26&nbsp;|Счёт №7&nbsp;|Смета&nbsp;|</p>`);
  });
});
