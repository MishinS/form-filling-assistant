import EmptyState from "@/components/shell/EmptyState";
import SourcesArchive from "@/components/sources/SourcesArchive";
import { auth } from "@/auth";
import { listSources } from "@/lib/db/fills";
import type { SourceRowData } from "@/lib/db/map";

export default async function SourcesPage() {
  const session = await auth();
  const userId = session?.user?.email ?? "";

  let sources: SourceRowData[] = [];
  if (userId) {
    try {
      sources = await listSources(userId);
    } catch {
      // DB not provisioned / unreachable — render the empty archive, never 500.
    }
  }

  return sources.length === 0 ? <EmptyState kind="sources" /> : <SourcesArchive sources={sources} />;
}
