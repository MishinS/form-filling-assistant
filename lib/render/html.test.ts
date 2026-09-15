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

  it("leaves no slot marker behind", () => {
    const r = renderHtml(`<p><!--slot:a--></p>`, [f("a")], [v("a", "x")]);
    expect(r.ok && r.html).not.toContain("slot:");
  });

  it("emits the section even when the value is empty", () => {
    const skeleton = `<td>Штрафы: <!--slot:a--></td>`;
    const r = renderHtml(skeleton, [f("a")], [v("a", "")]);
    expect(r).toEqual({ ok: true, html: `<td>Штрафы: </td>` });
  });

  it("emits the section when the field has no value at all", () => {
    const r = renderHtml(`<td>Штрафы: <!--slot:a--></td>`, [f("a")], []);
    expect(r).toEqual({ ok: true, html: `<td>Штрафы: </td>` });
  });

  it("renders a constant over an empty extracted value", () => {
    const fields = [f("a", { fillMode: "constant", constantValue: "Мишин С. С." })];
    const r = renderHtml(`<td>Запустил: <!--slot:a--></td>`, fields, [v("a", "")]);
    expect(r).toEqual({ ok: true, html: `<td>Запустил: Мишин С. С.</td>` });
  });

  it("renders a constant over a stray non-empty value", () => {
    const fields = [f("a", { fillMode: "constant", constantValue: "Мишин С. С." })];
    const r = renderHtml(`<td><!--slot:a--></td>`, fields, [v("a", "Иванов И. И.")]);
    expect(r).toEqual({ ok: true, html: `<td>Мишин С. С.</td>` });
  });

  it("falls back to the field's default when the documents said nothing", () => {
    const fields = [f("a", { defaultValue: "стандартные условия" })];
    const r = renderHtml(`<td>Штрафы: <!--slot:a--></td>`, fields, [v("a", "")]);
    expect(r).toEqual({ ok: true, html: `<td>Штрафы: стандартные условия</td>` });
  });

  it("prefers an extracted value over the default", () => {
    const fields = [f("a", { defaultValue: "стандартные условия" })];
    const r = renderHtml(`<td><!--slot:a--></td>`, fields, [v("a", "пеня 0,1% в день")]);
    expect(r).toEqual({ ok: true, html: `<td>пеня 0,1% в день</td>` });
  });

  it("refuses a field addressing a slot the skeleton lacks, with no partial document", () => {
    const r = renderHtml(`<p><!--slot:a--></p>`, [f("a"), f("b")], [v("a", "раз")]);
    expect(r).toEqual({ ok: false, error: { code: "unknown_slot", fieldId: "b" } });
  });

  it("refuses a skeleton slot that no field addresses", () => {
    const r = renderHtml(`<p><!--slot:a--><!--slot:b--></p>`, [f("a")], [v("a", "раз")]);
    expect(r).toEqual({ ok: false, error: { code: "unaddressed_slot", slot: "b" } });
  });

  it("refuses a slot that appears twice in the skeleton", () => {
    const r = renderHtml(`<p><!--slot:a--><!--slot:a--></p>`, [f("a")], [v("a", "раз")]);
    expect(r).toEqual({ ok: false, error: { code: "duplicate_slot", slot: "a" } });
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

  it("escapes an ampersand without double-escaping it", () => {
    const out = html(`<td><!--slot:a--></td>`, [f("a")], [v("a", `Рога & Копыта`)]);
    expect(out).toBe(`<td>Рога &amp; Копыта</td>`);
  });

  it("links an e-mail in a contact value with mailto:", () => {
    const fields = [f("a", { slotMode: "contact" })];
    const out = html(`<td><!--slot:a--></td>`, fields, [v("a", "Синицына Наталия, nata@validusmed.ru")]);
    expect(out).toBe(`<td>Синицына Наталия, <a href="mailto:nata@validusmed.ru">nata@validusmed.ru</a></td>`);
  });

  it("links a russian phone in a contact value with tel:", () => {
    const fields = [f("a", { slotMode: "contact" })];
    const out = html(`<td><!--slot:a--></td>`, fields, [v("a", "8 916 727 57 47")]);
    expect(out).toBe(`<td><a href="tel:+79167275747">8 916 727 57 47</a></td>`);
  });

  it("renders a javascript: URL in a contact value as plain text", () => {
    const fields = [f("a", { slotMode: "contact" })];
    const out = html(`<td><!--slot:a--></td>`, fields, [v("a", "javascript:alert(1)")]);
    expect(out).not.toContain("<a ");
    expect(out).toContain("javascript:alert(1)");
  });

  it("does not link an http URL in a contact value", () => {
    const fields = [f("a", { slotMode: "contact" })];
    const out = html(`<td><!--slot:a--></td>`, fields, [v("a", "см. http://example.com/x")]);
    expect(out).not.toContain("<a ");
  });

  it("escapes the visible text of a linked e-mail", () => {
    const fields = [f("a", { slotMode: "contact" })];
    const out = html(`<td><!--slot:a--></td>`, fields, [v("a", `<b>x</b> a@b.ru`)]);
    expect(out).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(out).toContain(`<a href="mailto:a@b.ru">a@b.ru</a>`);
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

  it("collapses blank lines between paragraphs", () => {
    const fields = [f("a", { slotMode: "paragraphs" })];
    const out = html(`<td><!--slot:a--></td>`, fields, [v("a", "раз\n\n\nдва")]);
    expect(out).toBe(`<td><p>раз</p><p>два</p></td>`);
  });

  it("wraps each paragraph in the template's own formatting", () => {
    const fields = [f("a", { slotMode: "paragraphs", paragraphHtml: `<p><strong>{}</strong></p>` })];
    const out = html(`<td><!--slot:a--></td>`, fields, [v("a", "раз\nдва")]);
    expect(out).toBe(`<td><p><strong>раз</strong></p><p><strong>два</strong></p></td>`);
  });

  it("renders an empty paragraphs value as nothing", () => {
    const fields = [f("a", { slotMode: "paragraphs" })];
    expect(html(`<td><!--slot:a--></td>`, fields, [v("a", "")])).toBe(`<td></td>`);
  });

  it("joins list items with the declared separator and leaves a trailing one", () => {
    const fields = [f("a", { slotMode: "list", listSeparator: "&nbsp;|" })];
    const out = html(`<p>Заказ&nbsp;|<!--slot:a--></p>`, fields, [v("a", "Договор №07_26\nСчёт №7\nСмета")]);
    expect(out).toBe(`<p>Заказ&nbsp;|Договор №07_26&nbsp;|Счёт №7&nbsp;|Смета&nbsp;|</p>`);
  });

  it("renders an empty list as the separator alone", () => {
    const fields = [f("a", { slotMode: "list", listSeparator: "&nbsp;|" })];
    expect(html(`<p>Заказ&nbsp;|<!--slot:a--></p>`, fields, [v("a", "")])).toBe(`<p>Заказ&nbsp;|&nbsp;|</p>`);
  });

  it("follows the upload, not the example's four blanks", () => {
    const fields = [f("a", { slotMode: "list", listSeparator: "|" })];
    const out = html(`<p><!--slot:a--></p>`, fields, [v("a", "1\n2\n3\n4\n5")]);
    expect(out.match(/\|/g)).toHaveLength(5);
  });

  it("escapes list items", () => {
    const fields = [f("a", { slotMode: "list", listSeparator: "|" })];
    expect(html(`<p><!--slot:a--></p>`, fields, [v("a", "<b>")])).toBe(`<p>&lt;b&gt;|</p>`);
  });

  it("joins lines with <br> inside a paragraph", () => {
    const fields = [f("a", { slotMode: "breaks" })];
    const out = html(`<p>Контрагент: <!--slot:a--></p>`, fields, [
      v("a", 'ООО "Валидус-ДМ", своё производство\nПоставили мебель для Ф08.'),
    ]);
    expect(out).toBe(
      `<p>Контрагент: ООО &quot;Валидус-ДМ&quot;, своё производство<br>Поставили мебель для Ф08.</p>`,
    );
  });

  it("renders an empty breaks value as nothing", () => {
    expect(html(`<p><!--slot:a--></p>`, [f("a", { slotMode: "breaks" })], [v("a", "")])).toBe(`<p></p>`);
  });

  it("leaves a text value as one escaped run", () => {
    const out = html(`<td><!--slot:a--></td>`, [f("a", { slotMode: "text" })], [v("a", "раз\nдва")]);
    expect(out).not.toContain("<p>");
    expect(out).toContain("раз");
  });
});
