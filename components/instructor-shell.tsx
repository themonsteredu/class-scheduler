"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Package, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/me", label: "내 스케쥴", icon: CalendarDays, exact: true },
  { href: "/me/equipment", label: "내 교구", icon: Package },
  { href: "/me/income", label: "내 수입", icon: Wallet },
];

export function InstructorShell({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-svh flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="mx-auto w-full max-w-3xl px-4 h-14 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold truncate">{name} 강사님</div>
          <SignOutButton variant="ghost" />
        </div>
        <nav className="mx-auto w-full max-w-3xl px-2 flex">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm border-b-2 transition-colors",
                  active
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl p-4">{children}</div>
      </main>
    </div>
  );
}
