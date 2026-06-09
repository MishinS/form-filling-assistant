import { auth } from "@/auth";
import { getUserByEmail } from "@/lib/db/users";
import SettingsView from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const session = await auth();
  const user = { name: session?.user?.name ?? "", email: session?.user?.email ?? "" };
  let editable = false;
  if (user.email) {
    // Editable only for DB-backed accounts; env-only owner accounts are read-only.
    try { editable = (await getUserByEmail(user.email)) != null; } catch { editable = false; }
  }
  return <SettingsView user={user} editable={editable} />;
}
