import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderHtml } from "./html";
import { checkSubset, NAVI_SUBSET } from "./subset";
import { ED_FIELDS } from "./ed";
import { ED_SKELETON_PATH } from "./ed-skeleton";

const skeleton = readFileSync(ED_SKELETON_PATH, "utf8");
const slotsIn = (s: string) => Array.from(s.matchAll(/<!--slot:([A-Za-z0-9_-]+)-->/g), (m) => m[1]);

describe("«Паспорт Заказа и договора» skeleton", () => {
  it("stays inside the subset the editor keeps", () => {
    expect(checkSubset(skeleton, NAVI_SUBSET)).toEqual({ ok: true });
  });
});

describe("ED_FIELDS catalog", () => {
  it("addresses only slots the skeleton declares, and every one of them", () => {
    const slots = slotsIn(skeleton);
    expect(ED_FIELDS.map((f) => f.cell).sort()).toEqual(slots.slice().sort());
  });

  it("puts «Запустил», «Инициатор» and «ЦФО» on one line in that order", () => {
    const row = skeleton.split("\n").find((l) => l.includes("Запустил"))!;
    expect(row).toBeDefined();
    expect(row.indexOf("Запустил")).toBeLessThan(row.indexOf("Инициатор"));
    expect(row.indexOf("Инициатор")).toBeLessThan(row.indexOf("ЦФО"));
    // «Инициатор» is a bare label — no slot between it and «ЦФО».
    const between = row.slice(row.indexOf("Инициатор"), row.indexOf("ЦФО"));
    expect(between).not.toContain("<!--slot:");
  });
});

describe("rendering the passport", () => {
  const values = [
    { fieldId: "e1", value: "Договор №07_26 от 11.08.26\nСчёт №7 от 11.08.26\nСмета" },
    { fieldId: "e2", value: 'Доп. стомат мебель в рамках проекта "1905"' },
    { fieldId: "e3", value: "ПРОЕКТЫ/1905/Мебель" },
    { fieldId: "e4", value: 'ООО "Валидус-ДМ", своё производство\nПоставили мебель для Ф08.' },
    { fieldId: "e5", value: "746 125 руб.\nАванс 60% - 447 675 руб.\n2 платеж 20% - 149 225 руб." },
    { fieldId: "e6", value: "закупка доп. мебели для стомат. кабинетов" },
    { fieldId: "e7", value: "" },
    { fieldId: "e8", value: "гарантия 12 месяцев" },
    { fieldId: "e9", value: "Синицына Наталия, 8 916 727 57 47, nata@validusmed.ru" },
    { fieldId: "e10", value: "" },
    { fieldId: "e11", value: "Суровцев" },
  ];

  const rendered = renderHtml(skeleton, ED_FIELDS, values);

  it("stays inside the editor's subset after rendering", () => {
    expect(rendered.ok && checkSubset(rendered.html, NAVI_SUBSET)).toEqual({ ok: true });
  });

  it("lists the three source documents with a trailing separator", () => {
    const html = rendered.ok ? rendered.html : "";
    expect(html).toContain("Заказ&nbsp;|Договор №07_26 от 11.08.26&nbsp;|Счёт №7 от 11.08.26&nbsp;|Смета&nbsp;|");
  });
});
