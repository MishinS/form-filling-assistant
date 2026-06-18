import type { DateRule } from "@/lib/extract/fields";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Вычислить дату по правилу относительно `now` (момент формирования файла) и
 *  отформатировать. Конец месяца для nextMonthSameDay зажимается. Всё в UTC. */
export function applyDateRule(rule: DateRule, now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  const d = now.getUTCDate();
  let target: Date;
  switch (rule.offset) {
    case "today":
      target = new Date(Date.UTC(y, m, d));
      break;
    case "nextDay":
      target = new Date(Date.UTC(y, m, d + 1));
      break;
    case "nextMonthSameDay": {
      const ny = m === 11 ? y + 1 : y;
      const nm = (m + 1) % 12;
      target = new Date(Date.UTC(ny, nm, Math.min(d, daysInMonth(ny, nm))));
      break;
    }
    case "firstOfNextMonth": {
      const ny = m === 11 ? y + 1 : y;
      const nm = (m + 1) % 12;
      target = new Date(Date.UTC(ny, nm, 1));
      break;
    }
  }
  if (rule.format === "monthYear") {
    return `${MONTHS_RU[target.getUTCMonth()]} ${target.getUTCFullYear()}`;
  }
  return `${pad(target.getUTCDate())}.${pad(target.getUTCMonth() + 1)}.${target.getUTCFullYear()}`;
}
