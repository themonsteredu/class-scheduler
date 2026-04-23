import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import {
  monthRange,
  thisMonthKST,
  todayISO,
  fmtTimeRange,
} from "@/lib/date";
import { fmtKRW } from "@/lib/money";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { MonthCalendar } from "@/components/month-calendar";
import type { ClassRequestRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const ym = thisMonthKST();
  const { start, end } = monthRange(ym);

  // Current + previous + next month (for calendar navigation range)
  const { data: monthRows } = await supabase
    .from("class_requests")
    .select("*, client:clients(id,name), instructor:instructors(id,name)")
    .eq("user_id", user.id)
    .order("class_date", { ascending: true });

  const allRows = (monthRows ?? []) as unknown as ClassRequestRow[];

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
                        className="flex items-center justify-between py-3 gap-4 hover:bg-accent/50 -mx-2 px-2 rounded-md"
                      >
                        <div className="flex flex-col">
                          <div className="text-sm font-medium">
                            {r.school_name ?? "(학교 미정)"} ·{" "}
                            {r.subject ?? "과목 미정"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {r.class_date}{" "}
                            {fmtTimeRange(r.start_time, r.end_time)} ·{" "}
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
                <div className="flex flex-col gap-6">
                  {instructorList.map((g) => (
                    <div key={g.name} className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-base font-semibold">{g.name}</h3>
                        <div className="text-xs text-muted-foreground">
                          예정 {g.active.length}건 · 지난 {g.past.length}건
                        </div>
                      </div>
                      {g.active.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          예정된 수업이 없습니다.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>날짜</TableHead>
                              <TableHead className="hidden sm:table-cell">시간</TableHead>
                              <TableHead>학교·과목</TableHead>
                              <TableHead className="hidden md:table-cell">업체</TableHead>
                              <TableHead className="text-right">
                                내 수입
                              </TableHead>
                              <TableHead>상태</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {g.active.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="whitespace-nowrap">
                                  <Link
                                    href={`/requests/${r.id}`}
                                    className="block"
                                  >
                                    {r.class_date ?? "—"}
                                  </Link>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-muted-foreground">
                                  {fmtTimeRange(r.start_time, r.end_time)}
                                </TableCell>
                                <TableCell>
                                  <Link
                                    href={`/requests/${r.id}`}
                                    className="block"
                                  >
                                    <div className="font-medium">
                                      {r.school_name ?? "—"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {r.subject ?? "—"} · {fmtTimeRange(r.start_time, r.end_time)}
                                    </div>
                                    <div className="text-xs text-muted-foreground md:hidden">
                                      {r.client?.name ?? ""}
                                    </div>
                                  </Link>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {r.client?.name ?? "—"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums whitespace-nowrap">
                                  {fmtKRW(r.fee_total)}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={r.status} />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
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
        <div className="text-base sm:text-2xl font-semibold tabular-nums truncate">
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
