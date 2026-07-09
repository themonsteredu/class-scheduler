"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "ghost" | "default";
  className?: string;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("로그아웃 되었습니다");
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant={variant} size="sm" onClick={signOut} className={className}>
      <LogOut className="h-4 w-4" /> 로그아웃
    </Button>
  );
}
