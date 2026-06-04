import Dashboard from "@/components/dashboard/Dashboard";
import { auth } from "@/auth";
import { listFills, fillStats, type FillStats } from "@/lib/db/fills";
import type { HistoryRowData } from "@/lib/db/map";

export default async function FillsPage() {
  const session = await auth();
  const userId = session?.user?.email ?? "";

  let fills: HistoryRowData[] = [];
  let stats: FillStats = { total: 0, month: 0, last: null };
  if (userId) {
    try {
      [fills, stats] = await Promise.all([listFills(userId), fillStats(userId)]);
    } catch {
      // DB not provisioned yet / unreachable — render the empty dashboard, never 500.
    }
  }
  return <Dashboard fills={fills} stats={stats} />;
}
