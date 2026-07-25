/** Is `value` acceptable for a field of this kind? Advisory only. Empty is always valid
 *  (the required check owns emptiness); only `amount` and `date` are validated. */
export function isValidValue(kind: string, value: string): boolean {
  const v = value.trim();
  if (v === "") return true;

  if (kind === "amount") {
    // Drop spaces (incl. NBSP) and a single currency symbol/word; treat comma as a decimal sep.
    const cleaned = v
      .replace(/[\s ]/g, "")
      .replace(/[₽$€]/g, "")
      .replace(/руб\.?/gi, "")
      .replace(/,/g, ".");
    return /^-?\d+(\.\d+)?$/.test(cleaned);
  }

  // Judge only values that are *attempting* a numeric calendar date, so a typo like
  // 31.02.2026 is still caught. Anything else is free-form term text ("14 календарных
  // дней", "по факту поставки") — legitimate content for «Срок оплаты», and the fill
  // layer already writes unparseable date values verbatim (lib/fill/values.ts), so
  // flagging it here would contradict what the app actually does with the value.
  if (kind === "date") return looksLikeCalendarDate(v) ? isRealDate(v) : true;

  return true;
}

/** Does this look like an attempt at a numeric date, whether or not it is a real one? */
function looksLikeCalendarDate(v: string): boolean {
  return /^\d{1,4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,4}$/.test(v);
}

/** Accept dd.mm.yyyy, dd/mm/yyyy, or yyyy-mm-dd and verify it is a real calendar date. */
function isRealDate(v: string): boolean {
  let y: number, m: number, d: number;
  let mtch: RegExpMatchArray | null;
  if ((mtch = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/))) {
    d = +mtch[1]; m = +mtch[2]; y = +mtch[3];
  } else if ((mtch = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    y = +mtch[1]; m = +mtch[2]; d = +mtch[3];
  } else {
    return false;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
