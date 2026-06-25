import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { parseThemeMode } from "@/lib/theme-core";
import GuestShell from "@/components/guest/GuestShell";

export default async function Home() {
  const session = await auth();
  // Полный (не-гостевой) пользователь → в кабинет.
  if (session?.user && session.user.role !== "guest" && session.user.email) {
    redirect("/fills");
  }
  const jar = await cookies();
  const initialMode = parseThemeMode(jar.get("theme")?.value);
  const initialLang = jar.get("lang")?.value === "en" ? "en" : "ru";
  return <GuestShell session={session} initialMode={initialMode} initialLang={initialLang} />;
}
