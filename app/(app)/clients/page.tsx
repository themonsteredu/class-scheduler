import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
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
import { ClientDialog } from "@/components/client-dialog";
import { ClientRowActions } from "@/components/client-row-actions";
import type { ClientRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });
  const rows = (data ?? []) as ClientRow[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">업체</h1>
          <p className="text-sm text-muted-foreground mt-1">총 {rows.length}곳</p>
        </div>
        <ClientDialog
          trigger={
            <Button size="sm" className="sm:size-default">
              <Plus className="h-4 w-4" /> 업체 추가
            </Button>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>업체 목록</CardTitle>
          <CardDescription>의뢰를 받는 중개 업체 또는 학교</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              등록된 업체가 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>업체명</TableHead>
                  <TableHead className="hidden sm:table-cell">담당자</TableHead>
                  <TableHead className="hidden md:table-cell">연락처</TableHead>
                  <TableHead className="hidden lg:table-cell">메모</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">
                        {[r.contact_person, r.phone].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {r.contact_person ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {r.phone ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[240px] truncate">
                      {r.memo ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ClientRowActions client={r} />
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
