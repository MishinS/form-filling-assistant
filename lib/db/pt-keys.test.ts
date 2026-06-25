import { describe, it, expect } from "vitest";
import { STR } from "@/lib/seed/pt";

const KEYS = [
  "cm_section","cm_add","cm_provider","cm_base_url","cm_model_id","cm_api_key","cm_label",
  "cm_testing","cm_added","cm_delete","cm_your_key","cm_empty","cm_consent_ack",
  "cm_err_auth","cm_err_model_not_found","cm_err_rate_limited","cm_err_unreachable",
  "cm_err_bad_response","cm_err_bad_endpoint","cm_err_provider_error",
  "reg_tos_label","reg_tos_text","register_err_consent",
];

describe("custom-model i18n keys", () => {
  it("exist in ru and en", () => {
    for (const k of KEYS) {
      expect(STR[k], k).toBeDefined();
      expect(STR[k].ru.length, `${k}.ru`).toBeGreaterThan(0);
      expect(STR[k].en.length, `${k}.en`).toBeGreaterThan(0);
    }
  });
});
