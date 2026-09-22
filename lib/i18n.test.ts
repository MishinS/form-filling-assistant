import { describe, it, expect } from "vitest";
import { translate } from "./i18n";

describe("translate", () => {

  it("has an invalid-value message per reason (ru + en)", () => {
    // FieldRow composes `review_invalid_${reason}` from the InvalidReason union in
    // lib/review/validate.ts. Every member needs a key in both locales, or the row
    // would render the key itself as its explanation.
    for (const reason of ["amount", "date"] as const) {
      for (const lang of ["ru", "en"] as const) {
        const key = `review_invalid_${reason}`;
        expect(translate(key, lang), `${key}/${lang} unresolved`).not.toBe(key);
      }
    }
  });

  it("has a message per ED template error and every ED editor string (ru + en)", () => {
    // errorKey() composes `ed_err_${code}` from the EdError union in lib/templates/ed-custom.ts.
    const codes = ["unknown_slot", "unaddressed_slot", "duplicate_slot", "duplicate_field", "subset",
      "unsafe_href", "instruction_too_long", "skeleton_too_long"];
    const modes = ["text", "breaks", "paragraphs", "contact", "list"];
    const keys = [...codes.map(c => `ed_err_${c}`), ...modes.map(m => `ed_mode_${m}`),
      "done_html_tpl_invalid", "ed_title", "ed_editor_h", "ed_tab_fields", "ed_tab_instruction", "ed_tab_skeleton",
      "ed_badge_default", "ed_badge_custom", "ed_reset_layer", "ed_reset_all", "ed_reset_done", "ed_new_field",
      "ed_delete_field", "ed_col_label_ru", "ed_col_label_en", "ed_col_hint", "ed_col_slot", "ed_col_mode",
      "ed_col_group", "ed_col_default", "ed_col_constant", "ed_constant", "ed_options", "ed_option_value",
      "ed_option_add", "ed_option_remove", "ed_slot_insert"];
    for (const key of keys) {
      for (const lang of ["ru", "en"] as const) {
        expect(translate(key, lang), `${key}/${lang} unresolved`).not.toBe(key);
      }
    }
  });
});
