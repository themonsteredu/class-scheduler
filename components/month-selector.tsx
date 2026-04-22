"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMonth, thisMonthKST } from "@/lib/date";

export function MonthSelector({ basePath }: { basePath: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const current = search.get("month") ?? thisMonthKST();

  function push(ym: string) {
    const params = new URLSearchParams(search.toString());
    if (ym) params.set("month", ym);
    else params.delete("month");
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => push(addMonth(current, -1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input
        type="month"
        className="w-40"
        value={current}
        onChange={(e) => push(e.target.value)}
      />
      <Button
        variant="outline"
        size="icon"
        onClick={() => push(addMonth(current, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => push(thisMonthKST())}>
        이번 달
      </Button>
    </div>
  );
}
