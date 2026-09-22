/** Rendering a template skeleton plus reviewed values into a document string for
 *  an external rich-text editor. Values reach us from third-party documents via a
 *  language model, so every one of them is escaped on the single substitution path
 *  below — there is no second place where a value can enter the output. */

/** How a field's value turns into markup. Closed set: a value never chooses its
 *  own rendering, so the amount of HTML it can produce is bounded by the template. */
export type SlotMode = "text" | "breaks" | "paragraphs" | "contact" | "list";

export interface RenderFieldSpec {
  id: string;
  /** Slot name in the skeleton (the `cell` column of an HTML template's field). */
  cell: string;
  slotMode?: SlotMode;
  /** `paragraphs`: wrapper for each line, `{}` marks where the escaped text goes. */
  paragraphHtml?: string;
  /** `list`: emitted between items and once after the last one. */
  listSeparator?: string;
  fillMode?: "auto" | "constant" | "date";
  constantValue?: string;
  /** Used when the resolved value is empty — the form requires a section to read
   *  as something rather than trail off after its label. */
  defaultValue?: string;
}

export type RenderError =
  | { code: "unknown_slot"; fieldId: string }
  | { code: "unaddressed_slot"; slot: string }
  | { code: "duplicate_slot"; slot: string };

export type RenderResult = { ok: true; html: string } | { ok: false; error: RenderError };

/** Matches the literal slot token only — not markup, so no HTML is being parsed. */
const SLOT_TOKEN = /<!--slot:([A-Za-z0-9_-]+)-->/g;

const DEFAULT_PARAGRAPH = "<p>{}</p>";
const DEFAULT_SEPARATOR = " | ";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Skeleton {
  /** Static HTML between slots; always one longer than `slots`. */
  chunks: string[];
  slots: string[];
}

function parseSkeleton(src: string): Skeleton | { duplicate: string } {
  const chunks: string[] = [];
  const slots: string[] = [];
  const seen = new Set<string>();
  let last = 0;
  SLOT_TOKEN.lastIndex = 0;
  for (let m = SLOT_TOKEN.exec(src); m; m = SLOT_TOKEN.exec(src)) {
    const name = m[1];
    if (seen.has(name)) return { duplicate: name };
    seen.add(name);
    chunks.push(src.slice(last, m.index));
    slots.push(name);
    last = m.index + m[0].length;
  }
  chunks.push(src.slice(last));
  return { chunks, slots };
}

/** Only these two schemes are ever emitted; everything else stays plain text. */
const CONTACT_TOKEN =
  /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|((?:\+7|8)[\s\-()]*(?:\d[\s\-()]*){10})/g;

function telHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return `+7${digits.slice(-10)}`;
}

function renderContact(value: string): string {
  let out = "";
  let last = 0;
  CONTACT_TOKEN.lastIndex = 0;
  for (let m = CONTACT_TOKEN.exec(value); m; m = CONTACT_TOKEN.exec(value)) {
    out += escapeHtml(value.slice(last, m.index));
    // A greedy trailing run of spaces/dashes belongs to the surrounding text.
    const text = m[0].replace(/[\s\-()]+$/, "");
    const tail = m[0].slice(text.length);
    const href = m[1] ? `mailto:${text}` : `tel:${telHref(text)}`;
    out += `<a href="${href}">${escapeHtml(text)}</a>${escapeHtml(tail)}`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(value.slice(last));
}

function renderValue(field: RenderFieldSpec, value: string): string {
  switch (field.slotMode ?? "text") {
    case "breaks":
      return lines(value).map(escapeHtml).join("<br>");
    case "paragraphs": {
      const wrap = field.paragraphHtml ?? DEFAULT_PARAGRAPH;
      return lines(value)
        // Функция-заменитель, а не строка: иначе `$&` или `$\x27` в значении
        // трактовались бы как шаблон подстановки и вытащили бы в документ обёртку.
        .map((l) => wrap.replace("{}", () => escapeHtml(l)))
        .join("");
    }
    case "list": {
      const sep = field.listSeparator ?? DEFAULT_SEPARATOR;
      const items = lines(value);
      // No items still leaves the separator: the row is a place the owner extends
      // by hand after pasting, so it must not collapse to nothing.
      if (items.length === 0) return sep;
      return items
        .map(escapeHtml)
        .map((item) => item + sep)
        .join("");
    }
    case "contact":
      return renderContact(value);
    default:
      return escapeHtml(value);
  }
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function renderHtml(
  skeletonSrc: string,
  fields: RenderFieldSpec[],
  values: Array<{ fieldId: string; value: string }>,
): RenderResult {
  const parsed = parseSkeleton(skeletonSrc);
  if ("duplicate" in parsed) {
    return { ok: false, error: { code: "duplicate_slot", slot: parsed.duplicate } };
  }

  const bySlot = new Map<string, RenderFieldSpec>();
  for (const f of fields) {
    if (!parsed.slots.includes(f.cell)) {
      return { ok: false, error: { code: "unknown_slot", fieldId: f.id } };
    }
    bySlot.set(f.cell, f);
  }
  for (const slot of parsed.slots) {
    if (!bySlot.has(slot)) return { ok: false, error: { code: "unaddressed_slot", slot } };
  }

  const byField = new Map(values.map((v) => [v.fieldId, v.value]));
  let out = parsed.chunks[0];
  parsed.slots.forEach((slot, i) => {
    const field = bySlot.get(slot)!;
    const extracted =
      field.fillMode === "constant" ? (field.constantValue ?? "") : (byField.get(field.id) ?? "");
    const value = extracted.trim() === "" ? (field.defaultValue ?? extracted) : extracted;
    out += renderValue(field, value) + parsed.chunks[i + 1];
  });
  return { ok: true, html: out };
}
