"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Building2,
  BarChart3,
  LogOut,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from "@radix-ui/react-dialog";

const NAV = [
  { href: "/", label: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/requests", label: "의뢰 목록", icon: ClipboardList },
  { href: "/instructors", label: "강사", icon: Users },
  { href: "/clients", label: "업체", icon: Building2 },
  { href: "/income", label: "수입 리포트", icon: BarChart3 },
];

export function AppShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r bg-card flex-col">
        <SidebarInner email={email} />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-card px-3 h-14">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="text-sm font-semibold">수업 스케줄러</div>
        <Button asChild size="sm" variant="outline">
          <Link href="/requests/new" aria-label="의뢰 등록">
            <Plus className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      {/* Mobile drawer */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-40 bg-black/60 md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
          <DialogContent
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-xl flex flex-col md:hidden",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
            )}
          >
            <DialogTitle className="sr-only">내비게이션</DialogTitle>
            <div className="flex items-center justify-between px-3 h-14 border-b">
              <div className="text-sm font-semibold">수업 스케줄러</div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SidebarInner email={email} />
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

function SidebarInner({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("로그아웃 되었습니다");
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <div className="p-4 hidden md:block border-b">
        <div className="text-base font-semibold">수업 스케줄러</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          진로수업 중개 관리
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2">
        <Button asChild className="w-full" size="sm">
          <Link href="/requests/new">
            <Plus className="h-4 w-4" /> 의뢰 등록
          </Link>
        </Button>
        <Button asChild className="w-full" size="sm" variant="outline">
          <Link href="/requests/bulk">여러 수업 한번에</Link>
        </Button>
      </div>

      <nav className="flex-1 px-2">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-secondary text-secondary-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t flex flex-col gap-2">
        {email && (
          <div className="text-xs text-muted-foreground truncate">{email}</div>
        )}
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" /> 로그아웃
        </Button>
      </div>
    </>
  );
}
