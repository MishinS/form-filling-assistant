import { describe,it,expect } from "vitest";
import { buildSchedule,parseSplit,round2 } from "./schedule";

describe("buildSchedule", () => {
  it("default is a single 100% «Аванс» row carrying the full total", () => {
    expect(buildSchedule(142275, 46142)).toEqual([
      { stage: "Аванс", percent: 100, amount: 142275, due: 46142 },
    ]);
  });
});

describe("parseSplit", () => {
  it("splits on explicit percents summing to 100", () => {
    expect(parseSplit("аванс 30%, постоплата 70% в течение 10 дней")).toEqual([30, 70]);
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
  it("ignores rate/penalty percents — не этапы оплаты", () => {
    expect(parseSplit("пени 0,1% за каждый день просрочки")).toBeNull();
    expect(parseSplit("ставка рефинансирования 8,25%")).toBeNull();
    expect(parseSplit("штраф 10% при расторжении")).toBeNull();
    expect(parseSplit("неустойка 0,5% от суммы")).toBeNull();
    // лишний не-этапный процент не убивает легитимную разбивку:
    expect(parseSplit("аванс 30%, постоплата 70%, пени 0,1% за день просрочки")).toEqual([30, 70]);
  });
});

describe("buildSchedule with terms text", () => {
  it("rounds to kopecks, last row takes the remainder (exact total)", () => {
    const rows = buildSchedule(10000.01, null, "33%, 33%, 34%");
    expect(rows.map(r => r.amount)).toEqual([3300, 3300, 3400.01]);
    expect(round2(rows.reduce((a, r) => a + r.amount, 0))).toBe(10000.01);
  });
});
