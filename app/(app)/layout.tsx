import { requireUser } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  return (
    <div className="flex min-h-svh">
      <AppSidebar email={user.email ?? null} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}
