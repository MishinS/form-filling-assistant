import { describe, it, expect } from "vitest";
import { applyDateRule } from "./daterule";

const JUN17 = new Date(Date.UTC(2026, 5, 17)); // 17 июня 2026

describe("applyDateRule", () => {
  it("today / dmy", () => {
    expect(applyDateRule({ offset: "today", format: "dmy" }, JUN17)).toBe("17.06.2026");
  });
  it("nextDay / dmy", () => {
    expect(applyDateRule({ offset: "nextDay", format: "dmy" }, JUN17)).toBe("18.06.2026");
  });
  it("nextDay переходит на следующий месяц", () => {
    const jun30 = new Date(Date.UTC(2026, 5, 30));
    expect(applyDateRule({ offset: "nextDay", format: "dmy" }, jun30)).toBe("01.07.2026");
  });
  it("nextMonthSameDay / dmy", () => {
    expect(applyDateRule({ offset: "nextMonthSameDay", format: "dmy" }, JUN17)).toBe("17.07.2026");
  });
  it("nextMonthSameDay зажимает конец месяца (невисокосный фев)", () => {
    const jan31 = new Date(Date.UTC(2026, 0, 31));
    expect(applyDateRule({ offset: "nextMonthSameDay", format: "dmy" }, jan31)).toBe("28.02.2026");
  });
  it("nextMonthSameDay зажимает на високосный февраль", () => {
    const jan31 = new Date(Date.UTC(2028, 0, 31)); // 2028 високосный
    expect(applyDateRule({ offset: "nextMonthSameDay", format: "dmy" }, jan31)).toBe("29.02.2028");
  });
  it("firstOfNextMonth / dmy", () => {
    expect(applyDateRule({ offset: "firstOfNextMonth", format: "dmy" }, JUN17)).toBe("01.07.2026");
  });
  it("декабрь переносит год", () => {
    const dec10 = new Date(Date.UTC(2026, 11, 10));
    expect(applyDateRule({ offset: "firstOfNextMonth", format: "dmy" }, dec10)).toBe("01.01.2027");
  });
  it("формат monthYear", () => {
    expect(applyDateRule({ offset: "nextMonthSameDay", format: "monthYear" }, JUN17)).toBe("Июль 2026");
  });
});
