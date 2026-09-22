import { describe,it,expect } from "vitest";
import { validateRegistration } from "./register";

const base = { email: "New@Mail.RU ", name: " Иван ", password: "longenough", inviteCode: "LETMEIN" };

describe("validateRegistration", () => {
  it("rejects a wrong invite code (error 'invite')", () => {
    expect(validateRegistration({ ...base, inviteCode: "nope" }, "LETMEIN")).toEqual({ ok: false, error: "invite" });
  });

  it("is closed when no expectedCode is configured", () => {
    expect(validateRegistration(base, undefined)).toEqual({ ok: false, error: "invite" });
    expect(validateRegistration(base, "")).toEqual({ ok: false, error: "invite" });
  });

  it("accepts valid input and normalizes email (lowercase+trim) and name (trim)", () => {
    expect(validateRegistration(base, "LETMEIN")).toEqual({ ok: true, email: "new@mail.ru", name: "Иван" });
  });
});
