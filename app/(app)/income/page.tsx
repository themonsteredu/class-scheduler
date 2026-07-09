import { Suspense } from "react";
import { requireUser } from "@/lib/supabase/server";
import { monthRange, thisMonthKST } from "@/lib/date";
import { fmtKRW, sumExtras } from "@/lib/money";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthSelector } from "@/components/month-selector";
import type { ClassRequestRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const ym = params.month || thisMonthKST();
  const { start, end } = monthRange(ym);

  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("class_requests")
    .select("*, client:clients(id,name), instructor:instructors(id,name)")
    .eq("user_id", user.id)
    .in("status", ["수업완료", "정산완료"])
    .gte("class_date", start)
    .lt("class_date", end)
    .order("class_date", { ascending: true });

  const rows = (data ?? []) as unknown as ClassRequestRow[];

  // 내 수입 = 재료비(부가항목 중 내 수입). 강사료는 업체가 강사에게 직접 지급.
  const myIncomeOf = (r: ClassRequestRow) => sumExtras(r.extra_fees, "me");
  const payoutOf = (r: ClassRequestRow) => Number(r.instructor_payout ?? 0);

  const totalIncome = rows.reduce((a, r) => a + myIncomeOf(r), 0);
  const totalPayout = rows.reduce((a, r) => a + payoutOf(r), 0);
  const classCount = rows.length;

  // by instructor — 강사료(그 강사가 번 돈)
  const byInstructor = new Map<
    string,
    { name: string; count: number; payout: number }
  >();
  for (const r of rows) {
    const key = r.instructor_id ?? "__self__";
    const name = r.instructor?.name ?? "본인 직접";
    const cur = byInstructor.get(key) ?? { name, count: 0, payout: 0 };
    cur.count += 1;
    cur.payout += payoutOf(r);
    byInstructor.set(key, cur);
  }

  // by client — 내 수입(재료비)
  const byClient = new Map<
    string,
    { name: string; count: number; income: number }
  >();
  for (const r of rows) {
    const key = r.client_id ?? "__none__";
    const name = r.client?.name ?? "(업체 미정)";
    const cur = byClient.get(key) ?? { name, count: 0, income: 0 };
    cur.count += 1;
    cur.income += myIncomeOf(r);
    byClient.set(key, cur);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">수입 리포트</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ym} · 수업완료·정산완료 상태만 집계
          </p>
        </div>
        <Suspense
          fallback={<div className="text-sm text-muted-foreground">…</div>}
        >
          <MonthSelector basePath="/income" />
        </Suspense>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Kpi title="내 수입 (재료비)" value={fmtKRW(totalIncome)} />
        <Kpi title="강사 지급 총액" value={fmtKRW(totalPayout)} hint="업체가 강사에게" />
        <Kpi title="수업 건수" value={`${classCount}건`} />
      </div>

      <Tabs defaultValue="by-class">
        <TabsList>
          <TabsTrigger value="by-class">수업별</TabsTrigger>
          <TabsTrigger value="by-instructor">강사별</TabsTrigger>
          <TabsTrigger value="by-client">업체별</TabsTrigger>
        </TabsList>

        <TabsContent value="by-class">
          <Card>
            <CardHeader>
              <CardTitle>수업별</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <Empty />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead>학교·과목</TableHead>
                      <TableHead className="hidden sm:table-cell">강사</TableHead>
                      <TableHead className="text-right hidden md:table-cell">강사료</TableHead>
                      <TableHead className="text-right">내 수입</TableHead>
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
                          <div className="text-xs text-muted-foreground sm:hidden">
                            {r.instructor?.name ?? "본인 직접"}
                            {r.client?.name ? ` · ${r.client.name}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {r.instructor?.name ?? "본인 직접"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums hidden md:table-cell text-muted-foreground whitespace-nowrap">
                          {fmtKRW(payoutOf(r))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium whitespace-nowrap">
                          {fmtKRW(myIncomeOf(r))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-instructor">
          <Card>
            <CardHeader>
              <CardTitle>강사별</CardTitle>
            </CardHeader>
            <CardContent>
              {byInstructor.size === 0 ? (
                <Empty />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>강사</TableHead>
                      <TableHead className="text-right">수업 수</TableHead>
                      <TableHead className="text-right">강사료</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...byInstructor.values()]
                      .sort((a, b) => b.payout - a.payout)
                      .map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.count}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {fmtKRW(row.payout)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-client">
          <Card>
            <CardHeader>
              <CardTitle>업체별</CardTitle>
            </CardHeader>
            <CardContent>
              {byClient.size === 0 ? (
                <Empty />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>업체</TableHead>
                      <TableHead className="text-right">수업 수</TableHead>
                      <TableHead className="text-right">내 수입</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...byClient.values()]
                      .sort((a, b) => b.income - a.income)
                      .map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.count}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {fmtKRW(row.income)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty() {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      집계할 내역이 없습니다.
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
        <div className="text-base sm:text-2xl font-semibold tabular-nums break-all leading-tight">
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
