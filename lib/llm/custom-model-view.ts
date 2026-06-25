export interface PickerRow { id: string; name: string; provider: string; custom?: boolean }

export function customPickerRows(
  dtos: { id: string; label: string; provider: string }[],
): PickerRow[] {
  return dtos.map((d) => ({ id: `custom:${d.id}`, name: d.label, provider: d.provider, custom: true }));
}
