import { Suspense } from "react";
import { requireInstructor } from "@/lib/supabase/server";
import { monthRange, thisMonthKST } from "@/lib/date";
import { fmtKRW } from "@/lib/money";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonthSelector } from "@/components/month-selector";
import { StatusBadge } from "@/components/status-badge";
import type { ClassRequestRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function MyIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const ym = params.month || thisMonthKST();
  const { start, end } = monthRange(ym);

  const { supabase, instructorId } = await requireInstructor();

  const { data } = await supabase
    .from("class_requests")
    .select("*")
    .eq("instructor_id", instructorId)
    .neq("status", "취소")
    .gte("class_date", start)
    .lt("class_date", end)
    .order("class_date", { ascending: true });

  const rows = (data ?? []) as unknown as ClassRequestRow[];
  const payoutOf = (r: ClassRequestRow) => Number(r.instructor_payout ?? 0);
  const total = rows.reduce((a, r) => a + payoutOf(r), 0);
  const confirmed = rows
    .filter((r) => r.status === "수업완료" || r.status === "정산완료")
    .reduce((a, r) => a + payoutOf(r), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">내 수입</h1>
          <p className="text-sm text-muted-foreground mt-1">{ym} · 강사료 기준</p>
        </div>
        <Suspense fallback={<div className="text-sm text-muted-foreground">…</div>}>
          <MonthSelector basePath="/me/income" />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Kpi title="이달 강사료 합계" value={fmtKRW(total)} />
        <Kpi title="확정(수업완료+)" value={fmtKRW(confirmed)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">수업별</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              해당 월 수업이 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead>학교·과목</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">강사료</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {r.class_date ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div>{r.school_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.subject ?? "—"}
                        {r.region ? ` · ${r.region}` : ""}
                        {r.sessions ? ` · ${r.sessions}차시` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium whitespace-nowrap">
                      {fmtKRW(payoutOf(r))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 p-3 sm:p-6">
        <CardTitle className="text-xs sm:text-sm text-muted-foreground font-normal">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
        <div className="text-base sm:text-2xl font-semibold tabular-nums break-all leading-tight">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
