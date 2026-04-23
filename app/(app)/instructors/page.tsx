import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { InstructorDialog } from "@/components/instructor-dialog";
import { InstructorRowActions } from "@/components/instructor-row-actions";
import { fmtKRW } from "@/lib/money";
import type { InstructorRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function InstructorsPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("instructors")
    .select("*")
    .eq("user_id", user.id)
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  const rows = (data ?? []) as InstructorRow[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">강사</h1>
          <p className="text-sm text-muted-foreground mt-1">총 {rows.length}명</p>
        </div>
        <InstructorDialog
          trigger={
            <Button size="sm" className="sm:size-default">
              <Plus className="h-4 w-4" /> 강사 추가
            </Button>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>강사 목록</CardTitle>
          <CardDescription>
            비활성 강사는 의뢰 등록 시 선택지에서 숨겨집니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              등록된 강사가 없습니다. 우측 상단의 "강사 추가"를 눌러 시작하세요.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead className="hidden sm:table-cell">연락처</TableHead>
                  <TableHead className="hidden md:table-cell">담당 과목</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">
                        {r.phone ?? ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {r.phone ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(r.subjects ?? []).map((s) => (
                          <Badge key={s} variant="secondary">
                            {s}
                          </Badge>
                        ))}
                        {(!r.subjects || r.subjects.length === 0) && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.active ? (
                        <Badge variant="success">활성</Badge>
                      ) : (
                        <Badge variant="muted">비활성</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <InstructorRowActions instructor={r} />
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
