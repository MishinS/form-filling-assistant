// Surgical single-cell rewrites on raw worksheet XML. No deps. Targets are known to
// exist in the образец, so an absent cell is a programmer error → throw.

const cellRe = (ref: string) =>
  new RegExp(`<c r="${ref}"((?:\\s[^>]*?)?)(?:/>|>([\\s\\S]*?)</c>)`);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const styleAttr = (attrs: string) => {
  const m = attrs.match(/\bs="(\d+)"/);
  return m ? ` s="${m[1]}"` : "";
};

/** Rewrite cell `ref` as an inline string ("string") or a number ("number"). Keeps style. */
export function writeCell(
  xml: string,
  ref: string,
  mode: "string" | "number",
  value: string | number,
): string {
  const m = xml.match(cellRe(ref));
  if (!m) throw new Error(`Cell ${ref} not found`);
  const s = styleAttr(m[1] || "");
  const rebuilt =
    mode === "string"
      ? `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(String(value))}</t></is></c>`
      : `<c r="${ref}"${s}><v>${value}</v></c>`;
  // Function-form replacement so `$` in `value` (e.g. "$&") is not treated as a
  // String.replace special pattern, which would inject the matched cell back in.
  return xml.replace(m[0], () => rebuilt);
}

/** Refresh the cached <v> of a formula cell (keep the <f>), so non-recalculating viewers show it. */
export function setFormulaCache(xml: string, ref: string, value: number): string {
  const m = xml.match(cellRe(ref));
  if (!m) throw new Error(`Cell ${ref} not found`);
  const attrs = m[1] || "";
  let inner = m[2] ?? "";
  if (/<v\s*\/>|<v>[\s\S]*?<\/v>/.test(inner)) {
    inner = inner.replace(/<v\s*\/>|<v>[\s\S]*?<\/v>/, `<v>${value}</v>`);
  } else if (/<\/f>/.test(inner)) {
    inner = inner.replace(/<\/f>/, `</f><v>${value}</v>`);
  } else {
    inner = `${inner}<v>${value}</v>`;
  }
  const rebuilt = `<c r="${ref}"${attrs}>${inner}</c>`;
  return xml.replace(m[0], () => rebuilt);
}
