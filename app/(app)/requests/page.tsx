import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { monthRange, fmtTimeRange } from "@/lib/date";
import { fmtKRW, sumExtras } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { StatusBadge } from "@/components/status-badge";
import { RequestFilters } from "@/components/request-filters";
import { ProgramMaterialManager } from "@/components/program-material-manager";
import { STATUS_VALUES, type RequestStatus } from "@/lib/schemas";
import type {
  ClassRequestRow,
  ClientRow,
  InstructorRow,
  ProgramMaterialFeeRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

interface SearchParams {
  month?: string;
  status?: string;
  client?: string;
  instructor?: string;
  q?: string;
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [clientsRes, instructorsRes, materialRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id,name")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("instructors")
      .select("id,name")
      .eq("user_id", user.id)
      .order("name"),
    supabase.from("program_material_fees").select("*").eq("user_id", user.id),
  ]);

  const clients = (clientsRes.data ?? []) as Pick<ClientRow, "id" | "name">[];
  const instructors = (instructorsRes.data ?? []) as Pick<
    InstructorRow,
    "id" | "name"
  >[];
  const materialFees = (materialRes.data ?? []) as ProgramMaterialFeeRow[];

  let query = supabase
    .from("class_requests")
    .select("*, client:clients(id,name), instructor:instructors(id,name)")
    .eq("user_id", user.id)
    .order("class_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (params.month) {
    const { start, end } = monthRange(params.month);
    query = query.gte("class_date", start).lt("class_date", end);
  }
  if (params.status && (STATUS_VALUES as readonly string[]).includes(params.status)) {
    query = query.eq("status", params.status as RequestStatus);
  }
  if (params.client) query = query.eq("client_id", params.client);
  if (params.instructor) query = query.eq("instructor_id", params.instructor);
  if (params.q) {
    const q = params.q.replace(/[%_]/g, "");
    query = query.or(`school_name.ilike.%${q}%,subject.ilike.%${q}%`);
  }

  const { data } = await query;
  const rows = (data ?? []) as unknown as ClassRequestRow[];

  // 내 수입 = 재료비(부가항목 중 내 수입).
  const totalFee = rows.reduce((acc, r) => acc + sumExtras(r.extra_fees, "me"), 0);

  const programNames = [
    ...new Set(
      [
        ...materialFees.map((m) => m.program_name),
        ...rows.map((r) => r.subject).filter((s): s is string => Boolean(s)),
      ].map((s) => s.trim()),
    ),
  ].sort();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">의뢰 목록</h1>
          <p className="text-sm text-muted-foreground mt-1">
            총 {rows.length}건 · 내 수입 합계 {fmtKRW(totalFee)}
          </p>
        </div>
        <div className="flex gap-2">
          <ProgramMaterialManager
            materialFees={materialFees}
            programNames={programNames}
            trigger={
              <Button size="sm" variant="outline">
                재료비 규칙
              </Button>
            }
          />
          <Button asChild size="sm" className="sm:size-default">
            <Link href="/requests/new">
              <Plus className="h-4 w-4" /> 의뢰 등록
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>필터</CardTitle>
          <CardDescription>URL 기반 필터 — 공유 가능</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={<div className="text-sm text-muted-foreground">불러오는 중…</div>}
          >
            <RequestFilters clients={clients} instructors={instructors} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              조건에 맞는 의뢰가 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜/시간</TableHead>
                  <TableHead>학교·과목</TableHead>
                  <TableHead className="hidden md:table-cell">학년·인원</TableHead>
                  <TableHead className="hidden sm:table-cell">강사</TableHead>
                  <TableHead className="hidden lg:table-cell">업체</TableHead>
                  <TableHead className="text-right">내 수입</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={undefined}
                  >
                    <TableCell>
                      <Link
                        href={`/requests/${r.id}`}
                        className="block"
                      >
                        <div>{r.class_date ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtTimeRange(r.start_time, r.end_time)}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/requests/${r.id}`} className="block">
                        <div className="font-medium">
                          {r.school_name ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.subject ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground sm:hidden">
                          {r.instructor?.name ?? "본인 직접"}
                          {r.client?.name ? ` · ${r.client.name}` : ""}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Link href={`/requests/${r.id}`} className="block">
                        {r.grade ?? "—"}
                        {r.student_count != null ? ` · ${r.student_count}명` : ""}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Link href={`/requests/${r.id}`} className="block">
                        {r.instructor?.name ?? "본인 직접"}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Link href={`/requests/${r.id}`} className="block">
                        {r.client?.name ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {fmtKRW(sumExtras(r.extra_fees, "me"))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
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
