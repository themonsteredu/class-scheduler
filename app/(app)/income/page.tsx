import { Suspense } from "react";
import { requireUser } from "@/lib/supabase/server";
import { monthRange, thisMonthKST } from "@/lib/date";
import { computeMyNet, fmtKRW, sumExtras } from "@/lib/money";
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

  const gross = rows.reduce((a, r) => a + Number(r.fee_total ?? 0), 0);
  const paidToInstructors = rows.reduce(
    (a, r) => a + Number(r.instructor_payout ?? 0),
    0,
  );
  const myCommission = rows.reduce(
    (a, r) => a + Number(r.my_commission ?? 0),
    0,
  );
  const myExtra = rows.reduce((a, r) => a + sumExtras(r.extra_fees, "me"), 0);
  const myNet = myCommission + myExtra;

  // by instructor
  const byInstructor = new Map<
    string,
    { name: string; count: number; gross: number; payout: number; myNet: number }
  >();
  for (const r of rows) {
    const key = r.instructor_id ?? "__self__";
    const name = r.instructor?.name ?? "본인 직접";
    const cur = byInstructor.get(key) ?? {
      name,
      count: 0,
      gross: 0,
      payout: 0,
      myNet: 0,
    };
    cur.count += 1;
    cur.gross += Number(r.fee_total ?? 0);
    cur.payout += Number(r.instructor_payout ?? 0);
    cur.myNet += computeMyNet({
      fee_total: r.fee_total,
      instructor_payout: r.instructor_payout,
      extra_fees: r.extra_fees,
    });
    byInstructor.set(key, cur);
  }

  // by client
  const byClient = new Map<
    string,
    { name: string; count: number; gross: number; myNet: number }
  >();
  for (const r of rows) {
    const key = r.client_id ?? "__none__";
    const name = r.client?.name ?? "(업체 미정)";
    const cur = byClient.get(key) ?? { name, count: 0, gross: 0, myNet: 0 };
    cur.count += 1;
    cur.gross += Number(r.fee_total ?? 0);
    cur.myNet += computeMyNet({
      fee_total: r.fee_total,
      instructor_payout: r.instructor_payout,
      extra_fees: r.extra_fees,
    });
    byClient.set(key, cur);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">수입 리포트</h1>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title="총 매출" value={fmtKRW(gross)} hint="수강료 합계" />
        <Kpi
          title="강사 지급 합계"
          value={fmtKRW(paidToInstructors)}
        />
        <Kpi title="내 수수료" value={fmtKRW(myCommission)} />
        <Kpi
          title="내 순수입"
          value={fmtKRW(myNet)}
          hint={`수수료 + 본인 부가수입(${fmtKRW(myExtra)})`}
        />
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
                <div className="py-8 text-center text-sm text-muted-foreground">
                  집계할 수업이 없습니다.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead>학교·과목</TableHead>
                      <TableHead>강사</TableHead>
                      <TableHead>업체</TableHead>
                      <TableHead className="text-right">매출</TableHead>
                      <TableHead className="text-right">강사료</TableHead>
                      <TableHead className="text-right">내 순수입</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="tabular-nums">
                          {r.class_date ?? "—"}
                        </TableCell>
                        <TableCell>
                          {r.school_name ?? "—"} ·{" "}
                          <span className="text-muted-foreground">
                            {r.subject ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {r.instructor?.name ?? "본인 직접"}
                        </TableCell>
                        <TableCell>{r.client?.name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtKRW(r.fee_total)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtKRW(r.instructor_payout)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {fmtKRW(
                            computeMyNet({
                              fee_total: r.fee_total,
                              instructor_payout: r.instructor_payout,
                              extra_fees: r.extra_fees,
                            }),
                          )}
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
                      <TableHead className="text-right">매출</TableHead>
                      <TableHead className="text-right">강사료 지급</TableHead>
                      <TableHead className="text-right">내 순수입</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...byInstructor.values()]
                      .sort((a, b) => b.myNet - a.myNet)
                      .map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.count}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtKRW(row.gross)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtKRW(row.payout)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {fmtKRW(row.myNet)}
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
                      <TableHead className="text-right">매출</TableHead>
                      <TableHead className="text-right">내 순수입</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...byClient.values()]
                      .sort((a, b) => b.myNet - a.myNet)
                      .map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.count}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtKRW(row.gross)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {fmtKRW(row.myNet)}
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
