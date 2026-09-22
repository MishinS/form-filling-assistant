import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { parseUsers, verifyCredentials } from "./users";

const hash = bcrypt.hashSync("secret123", 8);
const usersJson = JSON.stringify([{ email: "a@b.ru", name: "Анна", hash }]);

describe("parseUsers", () => {
  it("returns [] for malformed json", () => expect(parseUsers("{not json")).toEqual([]));
});

describe("verifyCredentials", () => {
  const users = parseUsers(usersJson);
  it("returns the user for correct email+password", async () =>
    expect(await verifyCredentials("a@b.ru", "secret123", users)).toEqual({ email: "a@b.ru", name: "Анна" }));
  it("returns null for wrong password", async () =>
    expect(await verifyCredentials("a@b.ru", "nope", users)).toBeNull());
});
