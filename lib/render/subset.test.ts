import { describe, it, expect } from "vitest";
import { checkSubset, NAVI_SUBSET } from "./subset";

const ok = (html: string) => checkSubset(html, NAVI_SUBSET);

describe("checkSubset", () => {
  it("accepts the markup the form is made of", () => {
    const html = `<table style="border-collapse: collapse;" border="1"><tbody><tr style="height: 63px;">` +
      `<td style="width: 100%; background-color: #8592a6;">` +
      `<span style="font-size: 24px; color: #ffffff;">Паспорт Заказа и договора</span>` +
      `</td></tr></tbody></table>` +
      `<p><span style="font-size: 14px;"><strong><span style="color: #00aeef;">Заказ</span></strong></span></p>`;
    expect(ok(html)).toEqual({ ok: true });
  });

  it("accepts a mailto link with a target", () => {
    expect(ok(`<a href="mailto:a@b.ru" target="_self">a@b.ru</a>`)).toEqual({ ok: true });
  });

  it("accepts a slot comment", () => {
    expect(ok(`<p>А: <!--slot:a--></p>`)).toEqual({ ok: true });
  });

  it("rejects an id attribute — the editor strips it and re-assigns its own", () => {
    expect(ok(`<p id="e0de3005">x</p>`)).toEqual({
      ok: false,
      error: { code: "id_attribute", tag: "p" },
    });
  });

  it("rejects a tag the editor does not keep", () => {
    expect(ok(`<p>x</p><script>alert(1)</script>`)).toEqual({
      ok: false,
      error: { code: "tag_not_allowed", tag: "script" },
    });
  });

  it("rejects an attribute the editor does not keep", () => {
    expect(ok(`<p onclick="alert(1)">x</p>`)).toEqual({
      ok: false,
      error: { code: "attr_not_allowed", tag: "p", attr: "onclick" },
    });
  });

  it("rejects a font size outside the editor's list", () => {
    expect(ok(`<span style="font-size: 16px;">x</span>`)).toEqual({
      ok: false,
      error: { code: "font_size_not_allowed", size: "16px" },
    });
  });

  it("accepts every font size the editor offers", () => {
    for (const size of NAVI_SUBSET.fontSizes) {
      expect(ok(`<span style="font-size: ${size};">x</span>`)).toEqual({ ok: true });
    }
  });

  it("fails closed on markup it cannot classify", () => {
    const r = ok(`<p>x</p><`);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("unparsable");
  });

  it("does not mistake a less-than sign in escaped text for a tag", () => {
    expect(ok(`<p>&lt;script&gt;</p>`)).toEqual({ ok: true });
  });
});
