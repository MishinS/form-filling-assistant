import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getFill } from "@/lib/db/fills";
import type { FillDetail } from "@/lib/db/map";
import FillDetailView from "@/components/dashboard/FillDetail";

export default async function FillDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) redirect("/fills");

  let data: FillDetail | null = null;
  try {
    data = await getFill(email, params.id);
  } catch {
    redirect("/fills"); // DB unreachable — never 500
  }
  if (!data) redirect("/fills"); // missing or not owned

  return <FillDetailView data={data} />;
}
