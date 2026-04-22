import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { monthRange, thisMonthKST, todayISO, fmtTimeRange } from "@/lib/date";
import { fmtKRW, computeMyNet } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import type { ClassRequestRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const ym = thisMonthKST();
  const { start, end } = monthRange(ym);

  const { data: monthRows } = await supabase
    .from("class_requests")
    .select("*, client:clients(id,name), instructor:instructors(id,name)")
    .eq("user_id", user.id)
    .gte("class_date", start)
    .lt("class_date", end)
    .order("class_date", { ascending: true });

  const rows = (monthRows ?? []) as unknown as ClassRequestRow[];
  const active = rows.filter((r) => r.status !== "취소");
  const totalCount = active.length;
  const expectedGross = active.reduce((acc, r) => acc + Number(r.fee_total ?? 0), 0);

  const confirmed = rows.filter(
    (r) => r.status === "수업완료" || r.status === "정산완료",
  );
  const myCommission = confirmed.reduce(
    (acc, r) => acc + Number(r.my_commission ?? 0),
    0,
  );
  const myNet = confirmed.reduce(
    (acc, r) =>
      acc +
      computeMyNet({
        fee_total: r.fee_total,
        instructor_payout: r.instructor_payout,
        extra_fees: r.extra_fees,
      }),
    0,
  );

  const today = todayISO();
  const { data: upcomingRows } = await supabase
    .from("class_requests")
    .select("*, client:clients(id,name), instructor:instructors(id,name)")
    .eq("user_id", user.id)
    .gte("class_date", today)
    .neq("status", "취소")
    .order("class_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(5);

  const upcoming = (upcomingRows ?? []) as unknown as ClassRequestRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ym} 기준 · 한국 시간(KST)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title="이번 달 의뢰" value={`${totalCount}건`} hint="취소 제외" />
        <Kpi
          title="예상 총 매출"
          value={fmtKRW(expectedGross)}
          hint="모든 의뢰 합계"
        />
        <Kpi
          title="확정 내 수수료"
          value={fmtKRW(myCommission)}
          hint="수업완료·정산완료"
        />
        <Kpi
          title="이번 달 순수입"
          value={fmtKRW(myNet)}
          hint="수수료 + 본인 부가수입"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>다가오는 수업</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              예정된 수업이 없습니다.
            </div>
          ) : (
            <ul className="divide-y">
              {upcoming.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/requests/${r.id}`}
                    className="flex items-center justify-between py-3 gap-4 hover:bg-accent/50 -mx-2 px-2 rounded-md"
                  >
                    <div className="flex flex-col">
                      <div className="text-sm font-medium">
                        {r.school_name ?? "(학교 미정)"} · {r.subject ?? "과목 미정"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {r.class_date} {fmtTimeRange(r.start_time, r.end_time)} ·{" "}
                        {r.instructor?.name ?? "본인 직접"} ·{" "}
                        {r.client?.name ?? "(업체 미정)"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm tabular-nums">
                        {fmtKRW(r.fee_total)}
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground font-normal">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && (
          <div className="text-xs text-muted-foreground mt-1">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}
