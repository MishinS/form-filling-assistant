export function contrastText(hex: string): "#0b0f0e" | "#f1f3f0" {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0b0f0e" : "#f1f3f0";
}
