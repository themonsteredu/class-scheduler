"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_VALUES } from "@/lib/schemas";

interface Props {
  clients: { id: string; name: string }[];
  instructors: { id: string; name: string }[];
}

const ALL = "__all__";

export function RequestFilters({ clients, instructors }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [, startTransition] = useTransition();

  const month = search.get("month") ?? "";
  const status = search.get("status") ?? ALL;
  const clientId = search.get("client") ?? ALL;
  const instructorId = search.get("instructor") ?? ALL;
  const q = search.get("q") ?? "";

  function push(patch: Record<string, string | null>) {
    const params = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "" || v === ALL) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/requests?${qs}` : "/requests");
    });
  }

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">월</label>
        <Input
          type="month"
          className="w-36"
          value={month}
          onChange={(e) => push({ month: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">상태</label>
        <Select value={status} onValueChange={(v) => push({ status: v })}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체</SelectItem>
            {STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">업체</label>
        <Select value={clientId} onValueChange={(v) => push({ client: v })}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">강사</label>
        <Select
          value={instructorId}
          onValueChange={(v) => push({ instructor: v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체</SelectItem>
            {instructors.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
        <label className="text-xs text-muted-foreground">학교·과목 검색</label>
        <Input
          defaultValue={q}
          placeholder="Enter로 검색"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              push({ q: (e.target as HTMLInputElement).value });
            }
          }}
        />
      </div>
      <Button variant="outline" onClick={() => router.push("/requests")}>
        초기화
      </Button>
    </div>
  );
}
