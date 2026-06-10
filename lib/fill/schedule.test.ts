import { describe, it, expect } from "vitest";
import { buildSchedule, parseSplit } from "./schedule";

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

describe("parseSplit", () => {
  it("splits on explicit percents summing to 100", () => {
    expect(parseSplit("аванс 30%, постоплата 70% в течение 10 дней")).toEqual([30, 70]);
  });
  it("completes the remainder for a single percent", () => {
    expect(parseSplit("предоплата 50%")).toEqual([50, 50]);
    expect(parseSplit("аванс 30% по счёту")).toEqual([30, 70]);
  });
  it("returns null for a lone 100%", () => {
    expect(parseSplit("оплата 100% после поставки")).toBeNull();
  });
  it("returns null when there are no percents", () => {
    expect(parseSplit("оплата в течение 30 дней")).toBeNull();
  });
  it("returns null when percents do not sum to 100", () => {
    expect(parseSplit("аванс 30%, потом 50%")).toBeNull();
  });
  it("ignores НДС clauses", () => {
    expect(parseSplit("оплата 100%, включая НДС 20%")).toBeNull(); // 100% одиночный → null
    expect(parseSplit("аванс 30%, постоплата 70%, в т.ч. НДС 20%")).toEqual([30, 70]);
    expect(parseSplit("НДС 20%")).toBeNull(); // не превращается в [20,80]
    expect(parseSplit("ставка 20% НДС")).toBeNull();
  });
  it("supports fractional percents with comma", () => {
    expect(parseSplit("аванс 33,5%, остаток 66,5%")).toEqual([33.5, 66.5]);
    expect(parseSplit("аванс 12,5%")).toEqual([12.5, 87.5]);
  });
  it("returns null for more than 5 stages", () => {
    expect(parseSplit("20%, 20%, 20%, 20%, 10%, 10%")).toBeNull();
  });
});
