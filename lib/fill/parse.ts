// Reverse of lib/extract/format.ts ru-RU formatting.

/** "418 600,00" (with NBSP/space thousands + comma decimal) → 418600. null if not numeric. */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\s\u00a0]/g, "")   // drop spaces + NBSP thousands separators
    .replace(/,/g, ".");          // comma decimal → dot
  const num = cleaned.replace(/[^0-9.\-]/g, "").replace(/\.+$/, ""); // strip currency words + trailing dot (e.g. "руб.")
  if (num === "" || num === "-" || num === ".") return null;
  const n = Number(num);
  return Number.isFinite(n) ? n : null;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30); // serial 0 (compensates 1900 leap bug for modern dates)

/** "dd.mm.yyyy" → Excel date serial. null if not a valid dd.mm.yyyy. */
export function parseDateSerial(raw: string): number | null {
  const m = raw?.trim().match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // Reject rollovers like "31.04.2026" (Date.UTC would silently roll to 01.05).
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mo - 1 || dt.getUTCFullYear() !== y) return null;
  const serial = Math.round((dt.getTime() - EXCEL_EPOCH) / 86400000);
  return serial > 0 ? serial : null;
}
