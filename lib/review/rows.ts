import type { ExtractedValue } from "@/lib/types";
import type { ExtractField } from "@/lib/extract/fields";
import type { PtField } from "@/lib/seed/pt";
import type { ParsedDoc } from "@/lib/parse/types";

/** Поля с фиксированным режимом (константа/дата) заполняются при заливке, минуя Review. */
const isManaged = (f: ExtractField) => f.fillMode === "constant" || f.fillMode === "date";

/** Required fields whose current (editable) value is empty — surfaced as a
 *  non-blocking warning on the Review step. `vals` is the live id→value map. */
export function missingRequired(fields: ExtractField[], vals: Record<string, string>): ExtractField[] {
  return fields.filter((f) => !isManaged(f) && f.required && !(vals[f.id] ?? "").trim());
}

export function buildRows(
  fields: ExtractField[],
  values: ExtractedValue[],
  docs: ParsedDoc[],
): PtField[] {
  const nameById = new Map(docs.map((d) => [d.fileId, d.name]));
  const valById = new Map(values.map((v) => [v.fieldId, v]));
  return fields.filter((f) => !isManaged(f)).map((f) => {
    const v = valById.get(f.id);
    const fileId = v?.source.fileId ?? null;
    const file = fileId ? nameById.get(fileId) ?? "—" : "—";
    const loc = v?.source.locator
      || (f.strategy === "manual" ? "проставьте вручную" : "не найдено в источниках");
    return {
      id: f.id, group: f.group, label_ru: f.label_ru, label_en: f.label_en,
      value: v?.value ?? "", cell: f.cell, conf: v?.confidence ?? "low",
      unit: f.unit, area: f.area, src: { file, loc },
    };
  });
}
