import { requireInstructor } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InstructorLoanReturn } from "@/components/instructor-loan-return";
import { fmtDate, todayISO } from "@/lib/date";
import type {
  EquipmentLoanRow,
  EquipmentComponentRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function MyEquipmentPage() {
  const { supabase, instructorId } = await requireInstructor();
  const today = todayISO();

  const [{ data: loanData }, { data: compData }] = await Promise.all([
    supabase
      .from("equipment_loans")
      .select("*, equipment:equipment(id,name)")
      .eq("instructor_id", instructorId)
      .order("checked_out_on", { ascending: false }),
    supabase.from("equipment_components").select("*"),
  ]);

  const loans = (loanData ?? []) as unknown as EquipmentLoanRow[];
  const components = (compData ?? []) as EquipmentComponentRow[];

  const compByEquipment = new Map<string, EquipmentComponentRow[]>();
  for (const c of components) {
    const arr = compByEquipment.get(c.equipment_id) ?? [];
    arr.push(c);
    compByEquipment.set(c.equipment_id, arr);
  }

  const out = loans.filter((l) => l.status === "대여중");
  const returned = loans.filter((l) => l.status === "반납완료");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">내 교구</h1>
        <p className="text-sm text-muted-foreground mt-1">
          지금 가진 교구를 반납 처리하고, 부족·파손을 남길 수 있어요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">대여중 ({out.length})</CardTitle>
          <CardDescription>반납하면 &quot;반납 처리&quot;를 눌러주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          {out.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              현재 가지고 있는 교구가 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {out.map((l) => {
                const overdue = l.due_on != null && l.due_on < today;
                return (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {l.equipment?.name ?? "교구"}{" "}
                        <span className="text-sm text-muted-foreground">× {l.quantity}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        대여 {fmtDate(l.checked_out_on)}
                        {l.due_on ? (
                          overdue ? (
                            <span className="text-destructive"> · 반납예정 {fmtDate(l.due_on)} (지남)</span>
                          ) : (
                            <span> · 반납예정 {fmtDate(l.due_on)}</span>
                          )
                        ) : null}
                      </div>
                    </div>
                    <InstructorLoanReturn
                      loan={l}
                      components={compByEquipment.get(l.equipment_id) ?? []}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">반납 이력</CardTitle>
        </CardHeader>
        <CardContent>
          {returned.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              반납한 교구가 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {returned.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {l.equipment?.name ?? "교구"}{" "}
                      <span className="text-sm text-muted-foreground">× {l.quantity}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      반납 {fmtDate(l.returned_on)}
                      {l.condition_memo ? ` · ${l.condition_memo}` : ""}
                    </div>
                  </div>
                  <Badge variant="muted">반납완료</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
