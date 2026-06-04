import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { parseUsers, verifyCredentials } from "./users";

const hash = bcrypt.hashSync("secret123", 8);
const usersJson = JSON.stringify([{ email: "a@b.ru", name: "Анна", hash }]);

describe("parseUsers", () => {
  it("parses a valid array", () => expect(parseUsers(usersJson)).toHaveLength(1));
  it("returns [] for undefined", () => expect(parseUsers(undefined)).toEqual([]));
  it("returns [] for malformed json", () => expect(parseUsers("{not json")).toEqual([]));
  it("returns [] for a non-array", () => expect(parseUsers('{"email":"x"}')).toEqual([]));
  it("drops entries missing keys", () => expect(parseUsers('[{"email":"x@y"}]')).toEqual([]));
});

describe("verifyCredentials", () => {
  const users = parseUsers(usersJson);
  it("returns the user for correct email+password", async () =>
    expect(await verifyCredentials("a@b.ru", "secret123", users)).toEqual({ email: "a@b.ru", name: "Анна" }));
  it("is case-insensitive on email", async () =>
    expect(await verifyCredentials("A@B.RU", "secret123", users)).toEqual({ email: "a@b.ru", name: "Анна" }));
  it("returns null for wrong password", async () =>
    expect(await verifyCredentials("a@b.ru", "nope", users)).toBeNull());
  it("returns null for unknown email", async () =>
    expect(await verifyCredentials("z@z.ru", "secret123", users)).toBeNull());
  it("returns null for an empty user list", async () =>
    expect(await verifyCredentials("a@b.ru", "secret123", [])).toBeNull());
});
