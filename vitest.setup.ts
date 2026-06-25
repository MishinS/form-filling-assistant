import { vi } from "vitest";

// Mock node:dns/promises to return public IPs for test domains
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn((host: string) => {
    if (host === "api.example.com") {
      return Promise.resolve([{ address: "1.1.1.1" }]);
    }
    // Fall back to real DNS for other hosts
    const actual = require("node:dns/promises");
    return actual.lookup(host, { all: true });
  }),
}));
