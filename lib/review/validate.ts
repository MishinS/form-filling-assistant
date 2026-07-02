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

  if (kind === "date") return isRealDate(v);

  return true;
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
