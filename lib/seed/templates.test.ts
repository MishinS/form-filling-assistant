import { describe, it, expect } from "vitest";
import { TEMPLATES } from "./pt";
import { ED_FIELDS, ED_TEMPLATE_ID } from "@/lib/render/ed";

describe("built-in template gallery", () => {
  it("offers the order passport alongside the payment request", () => {
    expect(TEMPLATES.map((t) => t.id)).toContain(ED_TEMPLATE_ID);
  });

  it("shows the passport as an HTML template with its real field count", () => {
    const ed = TEMPLATES.find((t) => t.id === ED_TEMPLATE_ID)!;
    expect(ed.format).toBe("HTML");
    expect(ed.fields).toBe(ED_FIELDS.length);
  });

  it("keeps built-in ids unique", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
});
