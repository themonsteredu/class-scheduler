import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import {
  monthRange,
  thisMonthKST,
  todayISO,
  fmtCompactWhen,
  fmtDate,
  addMonth,
} from "@/lib/date";
import { fmtKRW } from "@/lib/money";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { MonthCalendar } from "@/components/month-calendar";
import type {
  ClassRequestRow,
  EquipmentRow,
  EquipmentLoanRow,
  EquipmentComponentRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const ym = thisMonthKST();
  const { start, end } = monthRange(ym);

  // Load -3 / +6 months around current month for calendar + lists
  // (Keeps query fast; calendar can still navigate but will show empty past months)
  const { start: rangeStart } = monthRange(addMonth(ym, -3));
  const { end: rangeEnd } = monthRange(addMonth(ym, 6));

  const { data: monthRows } = await supabase
    .from("class_requests")
    .select("*, client:clients(id,name), instructor:instructors(id,name)")
    .eq("user_id", user.id)
    .gte("class_date", rangeStart)
    .lt("class_date", rangeEnd)
    .order("class_date", { ascending: true });

  const allRows = (monthRows ?? []) as unknown as ClassRequestRow[];

  // Equipment status widget data
  const [
    { data: eqData },
    { data: eqLoanData },
    { data: eqComponentData },
  ] = await Promise.all([
    supabase.from("equipment").select("*").eq("user_id", user.id).eq("active", true),
    supabase
      .from("equipment_loans")
      .select("*, equipment:equipment(id,name), instructor:instructors(id,name)")
      .eq("user_id", user.id)
      .eq("status", "대여중")
      .order("checked_out_on", { ascending: true }),
    supabase.from("equipment_components").select("*").eq("user_id", user.id),
  ]);

  const eqList = (eqData ?? []) as EquipmentRow[];
  const eqLoans = (eqLoanData ?? []) as unknown as EquipmentLoanRow[];
  const eqComponents = (eqComponentData ?? []) as EquipmentComponentRow[];

  const eqCheckedOut = new Map<string, number>();
  for (const l of eqLoans) {
    eqCheckedOut.set(l.equipment_id, (eqCheckedOut.get(l.equipment_id) ?? 0) + l.quantity);
  }
  const eqCompByEquipment = new Map<string, EquipmentComponentRow[]>();
  for (const c of eqComponents) {
    const arr = eqCompByEquipment.get(c.equipment_id) ?? [];
    arr.push(c);
    eqCompByEquipment.set(c.equipment_id, arr);
  }
  const restockNames: string[] = [];
  for (const e of eqList) {
    const available = e.total_quantity - (eqCheckedOut.get(e.id) ?? 0);
    const compShort = (eqCompByEquipment.get(e.id) ?? []).some(
      (c) => c.total_quantity <= c.low_stock_threshold,
    );
    if (available <= e.low_stock_threshold || compShort) restockNames.push(e.name);
  }
  const overdueLoans = eqLoans.filter((l) => l.due_on != null && l.due_on < todayISO());

  const currentMonthRows = allRows.filter(
    (r) =>
      r.class_date &&
      r.class_date >= start &&
      r.class_date < end &&
      r.status !== "취소",
  );
  const totalCount = currentMonthRows.length;
  const expectedIncome = currentMonthRows.reduce(
    (acc, r) => acc + Number(r.fee_total ?? 0),
    0,
  );
  const confirmedIncome = currentMonthRows
    .filter((r) => r.status === "수업완료" || r.status === "정산완료")
    .reduce((acc, r) => acc + Number(r.fee_total ?? 0), 0);

  const today = todayISO();
  const upcoming = allRows
    .filter(
      (r) => r.class_date && r.class_date >= today && r.status !== "취소",
    )
    .slice(0, 5);

  // by instructor (all future + current month)
  const byInstructor = new Map<
    string,
    { name: string; active: ClassRequestRow[]; past: ClassRequestRow[] }
  >();
  for (const r of allRows) {
    if (r.status === "취소") continue;
    const key = r.instructor_id ?? "__self__";
    const name = r.instructor?.name ?? "본인 직접";
    const cur = byInstructor.get(key) ?? { name, active: [], past: [] };
    if (r.class_date && r.class_date >= today) {
      cur.active.push(r);
    } else {
      cur.past.push(r);
    }
    byInstructor.set(key, cur);
  }
  const instructorList = [...byInstructor.values()]
    .sort((a, b) => {
      if (a.name === "본인 직접") return -1;
      if (b.name === "본인 직접") return 1;
      return b.active.length - a.active.length;
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ym} 기준 · 한국 시간(KST)
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Kpi title="이번 달 수업" value={`${totalCount}건`} hint="취소 제외" />
        <Kpi
          title="예상 수입"
          value={fmtKRW(expectedIncome)}
          hint="모든 상태 합계"
        />
        <Kpi
          title="확정 수입"
          value={fmtKRW(confirmedIncome)}
          hint="수업완료·정산완료"
        />
      </div>

      {(eqList.length > 0 || eqLoans.length > 0) && (
        <Link href="/equipment" className="block">
          <Card className="hover:bg-accent/40 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" /> 교구 현황
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {restockNames.length > 0 ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> 보충 필요 {restockNames.length}종
                  </Badge>
                ) : (
                  <Badge variant="success">재고 충분</Badge>
                )}
                <Badge variant={eqLoans.length > 0 ? "secondary" : "muted"}>
                  대여중 {eqLoans.length}건
                </Badge>
                {overdueLoans.length > 0 && (
                  <Badge variant="destructive">반납 지연 {overdueLoans.length}건</Badge>
                )}
              </div>

              {restockNames.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  보충: {restockNames.slice(0, 4).join(", ")}
                  {restockNames.length > 4 && ` 외 ${restockNames.length - 4}종`}
                </div>
              )}

              {eqLoans.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {eqLoans.slice(0, 3).map((l) => {
                    const overdue = l.due_on != null && l.due_on < today;
                    return (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate">
                          {l.equipment?.name ?? "교구"} · {l.instructor?.name ?? "본인 보관"}
                        </span>
                        <span
                          className={
                            overdue ? "text-destructive shrink-0" : "text-muted-foreground shrink-0"
                          }
                        >
                          {l.due_on ? `~${fmtDate(l.due_on)}${overdue ? " 지남" : ""}` : "기한 없음"}
                        </span>
                      </li>
                    );
                  })}
                  {eqLoans.length > 3 && (
                    <li className="text-xs text-muted-foreground">
                      외 {eqLoans.length - 3}건…
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </Link>
      )}

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">달력</TabsTrigger>
          <TabsTrigger value="upcoming">다가오는 수업</TabsTrigger>
          <TabsTrigger value="by-instructor">강사별</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card>
            <CardContent className="pt-6">
              <MonthCalendar rows={allRows} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
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
                        className="flex items-center justify-between gap-3 py-3 hover:bg-accent/50 -mx-2 px-2 rounded-md"
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {fmtCompactWhen(r.class_date, r.start_time)}
                          </div>
                          <div className="text-sm font-medium truncate">
                            {r.school_name ?? "(학교 미정)"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.subject ?? "과목 미정"} ·{" "}
                            {r.instructor?.name ?? "본인 직접"}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <StatusBadge status={r.status} />
                          {Number(r.fee_total) > 0 && (
                            <div className="text-xs tabular-nums text-muted-foreground">
                              {fmtKRW(r.fee_total)}
                            </div>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-instructor">
          <Card>
            <CardHeader>
              <CardTitle>강사별 수업</CardTitle>
            </CardHeader>
            <CardContent>
              {instructorList.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  등록된 수업이 없습니다.
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {instructorList.map((g) => (
                    <div key={g.name} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3 pb-1 border-b">
                        <h3 className="text-sm sm:text-base font-semibold truncate">
                          {g.name}
                        </h3>
                        <div className="text-xs text-muted-foreground shrink-0">
                          예정 {g.active.length} · 지난 {g.past.length}
                        </div>
                      </div>
                      {g.active.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2">
                          예정된 수업이 없습니다.
                        </div>
                      ) : (
                        <ul className="divide-y">
                          {g.active.map((r) => (
                            <li key={r.id}>
                              <Link
                                href={`/requests/${r.id}`}
                                className="flex items-center justify-between gap-3 py-2 hover:bg-accent/50 -mx-2 px-2 rounded-md"
                              >
                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="text-xs text-muted-foreground tabular-nums">
                                    {fmtCompactWhen(r.class_date, r.start_time)}
                                  </div>
                                  <div className="text-sm font-medium truncate">
                                    {r.school_name ?? "—"}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {r.subject ?? "—"}
                                    {r.client?.name ? ` · ${r.client.name}` : ""}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <StatusBadge status={r.status} />
                                  {Number(r.fee_total) > 0 && (
                                    <div className="text-xs tabular-nums text-muted-foreground">
                                      {fmtKRW(r.fee_total)}
                                    </div>
                                  )}
                                </div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
      <CardHeader className="pb-2 p-3 sm:p-6">
        <CardTitle className="text-xs sm:text-sm text-muted-foreground font-normal">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
        <div className="text-sm sm:text-2xl font-semibold tabular-nums break-all leading-tight">
          {value}
        </div>
        {hint && (
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
