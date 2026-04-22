"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/requests", label: "의뢰 목록", icon: ClipboardList },
  { href: "/instructors", label: "강사", icon: Users },
  { href: "/clients", label: "업체", icon: Building2 },
  { href: "/income", label: "수입 리포트", icon: BarChart3 },
];

export function AppSidebar({ email }: { email: string | null }) {
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
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
      <div className="p-4 border-b">
        <div className="text-base font-semibold">수업 스케줄러</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          진로수업 중개 관리
        </div>
      </div>

      <div className="p-3">
        <Button asChild className="w-full" size="sm">
          <Link href="/requests/new">
            <Plus className="h-4 w-4" /> 의뢰 등록
          </Link>
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
    </aside>
  );
}
