import type { Locator } from "@/lib/parse/types";

export function locatorRu(loc: Locator): string {
  switch (loc.kind) {
    case "pdf":  return `стр. ${loc.page}`;
    case "xlsx": return `${loc.sheet} · ${loc.cell}`;
    case "docx": return `блок ${loc.block + 1}`;
  }
}
