import { describe, it, expect } from "vitest";
import { guestUser } from "./guest";

describe("guestUser", () => {
  it("always returns a guest principal with no email", () => {
    const u = guestUser();
    expect(u.role).toBe("guest");
    expect(u.email).toBeNull();
    expect(u.name).toBe("Гость");
    expect(u.id.startsWith("guest:")).toBe(true);
  });
  it("mints a unique id each call", () => {
    expect(guestUser().id).not.toBe(guestUser().id);
  });
});
