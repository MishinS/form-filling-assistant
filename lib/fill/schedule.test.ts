import { describe, it, expect } from "vitest";
import { buildSchedule } from "./schedule";

describe("buildSchedule", () => {
  it("default is a single 100% «Аванс» row carrying the full total", () => {
    expect(buildSchedule(142275, 46142)).toEqual([
      { stage: "Аванс", percent: 100, amount: 142275, due: 46142 },
    ]);
  });
  it("keeps a null due date", () => {
    expect(buildSchedule(100000, null)).toEqual([
      { stage: "Аванс", percent: 100, amount: 100000, due: null },
    ]);
  });
});
