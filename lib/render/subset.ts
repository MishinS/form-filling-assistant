/** The element/attribute subset a destination editor keeps on paste. Declared as
 *  data so the contract with an editor we do not control is visible and testable
 *  rather than assumed inside the renderer. */

export interface EditorSubset {
  tags: string[];
  /** Attributes allowed on any tag. */
  globalAttrs: string[];
  /** Extra attributes allowed on a given tag. */
  tagAttrs: Record<string, string[]>;
  /** Inline font sizes the editor offers; anything else it rewrites. */
  fontSizes: string[];
}

export type SubsetError =
  | { code: "tag_not_allowed"; tag: string }
  | { code: "attr_not_allowed"; tag: string; attr: string }
  | { code: "id_attribute"; tag: string }
  | { code: "font_size_not_allowed"; size: string }
  | { code: "unparsable"; at: number };

export type SubsetResult = { ok: true } | { ok: false; error: SubsetError };

/** navi's TinyMCE, read from `components/TextEditor/tinyMCE/tinyMCEInit.ts`:
 *  `schema: 'html5'`, `extended_valid_elements` and `font_size_formats`. `id` is
 *  absent on purpose — `components/TextEditor/lib/paste.ts` removes it on paste. */
export const NAVI_SUBSET: EditorSubset = {
  tags: [
    "p", "span", "strong", "em", "u", "s", "sup", "sub", "br", "hr", "a", "div",
    "table", "tbody", "thead", "tfoot", "tr", "td", "th",
    "ul", "ol", "li", "pre", "h1", "h2", "h3", "h4",
  ],
  globalAttrs: ["style", "data-options", "class"],
  tagAttrs: {
    a: ["href", "target"],
    table: ["border"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  fontSizes: ["8px", "10px", "12px", "14px", "18px", "24px", "36px"],
};

const COMMENT = "<!--";
const TAG = /^<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"]|"[^"]*")*)\/?>/;
const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const FONT_SIZE = /font-size\s*:\s*([0-9.]+px)/gi;

/** Scans a skeleton we authored ourselves. Anything it cannot classify is an
 *  error, never a pass: a skeleton that confuses the checker is a skeleton we
 *  cannot promise anything about. */
export function checkSubset(html: string, subset: EditorSubset): SubsetResult {
  const tags = new Set(subset.tags);
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;

    if (html.startsWith(COMMENT, lt)) {
      const end = html.indexOf("-->", lt + COMMENT.length);
      if (end === -1) return { ok: false, error: { code: "unparsable", at: lt } };
      i = end + 3;
      continue;
    }

    const m = TAG.exec(html.slice(lt));
    if (!m) return { ok: false, error: { code: "unparsable", at: lt } };

    const tag = m[1].toLowerCase();
    if (!tags.has(tag)) return { ok: false, error: { code: "tag_not_allowed", tag } };

    const allowed = new Set([...subset.globalAttrs, ...(subset.tagAttrs[tag] ?? [])]);
    const attrs = m[2] ?? "";
    ATTR.lastIndex = 0;
    for (let a = ATTR.exec(attrs); a; a = ATTR.exec(attrs)) {
      const name = a[1].toLowerCase();
      if (name === "id") return { ok: false, error: { code: "id_attribute", tag } };
      if (!allowed.has(name)) return { ok: false, error: { code: "attr_not_allowed", tag, attr: name } };
    }

    FONT_SIZE.lastIndex = 0;
    for (let s = FONT_SIZE.exec(attrs); s; s = FONT_SIZE.exec(attrs)) {
      if (!subset.fontSizes.includes(s[1].toLowerCase())) {
        return { ok: false, error: { code: "font_size_not_allowed", size: s[1] } };
      }
    }

    i = lt + m[0].length;
  }
  return { ok: true };
}
