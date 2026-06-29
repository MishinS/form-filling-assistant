export interface PickerRow { id: string; name: string; provider: string; custom?: boolean; local?: boolean }

export function customPickerRows(
  dtos: { id: string; label: string; provider: string }[],
): PickerRow[] {
  return dtos.map((d) => ({ id: `custom:${d.id}`, name: d.label, provider: d.provider, custom: true }));
}

const ERR_KEYS = new Set([
  "auth", "model_not_found", "rate_limited", "unreachable", "bad_response", "bad_endpoint", "provider_error",
]);
export function errorLabelKey(code: string): string {
  return ERR_KEYS.has(code) ? `cm_err_${code}` : "cm_err_provider_error";
}
