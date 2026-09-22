import { describe,it,expect } from "vitest";
import { escapeLike } from "./search";

describe("escapeLike", () => {
  it("escapes LIKE wildcards and the escape char", () => {
    expect(escapeLike("50%_done\\")).toBe("50\\%\\_done\\\\");
  });
});
