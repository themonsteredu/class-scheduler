import { requireAdmin } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdmin();
  return <AppShell email={user.email ?? null}>{children}</AppShell>;
}
