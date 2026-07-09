import { requireInstructor } from "@/lib/supabase/server";
import { todayISO, fmtCompactWhen } from "@/lib/date";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import type { ClassRequestRow, ProgramEquipmentRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function MySchedulePage() {
  const { supabase, instructorId } = await requireInstructor();
  const today = todayISO();

  // program_equipment / class_requests are scoped by RLS to this instructor.
  const [{ data: classData }, { data: mapData }] = await Promise.all([
    supabase
      .from("class_requests")
      .select("*")
      .eq("instructor_id", instructorId)
      .neq("status", "취소")
      .gte("class_date", today)
      .order("class_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase.from("program_equipment").select("*, equipment:equipment(id,name)"),
  ]);

  const classes = (classData ?? []) as unknown as ClassRequestRow[];
  const mappings = (mapData ?? []) as unknown as ProgramEquipmentRow[];

  const mapByProgram = new Map<string, ProgramEquipmentRow[]>();
  for (const m of mappings) {
    const arr = mapByProgram.get(m.program_name) ?? [];
    arr.push(m);
    mapByProgram.set(m.program_name, arr);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">내 스케쥴</h1>
        <p className="text-sm text-muted-foreground mt-1">
          다가오는 수업 {classes.length}건 · 각 수업에 필요한 교구도 함께 표시됩니다.
        </p>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            예정된 수업이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {classes.map((c) => {
            const req = c.subject ? mapByProgram.get(c.subject.trim()) ?? [] : [];
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span className="tabular-nums text-muted-foreground font-normal">
                      {fmtCompactWhen(c.class_date, c.start_time)}
                    </span>
                    <StatusBadge status={c.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex flex-col gap-1.5">
                  <div className="font-medium">{c.school_name ?? "(학교 미정)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.subject ?? "과목 미정"}
                    {c.grade ? ` · ${c.grade}` : ""}
                    {c.student_count != null ? ` · ${c.student_count}명` : ""}
                    {c.region ? ` · ${c.region}` : ""}
                    {c.sessions ? ` · ${c.sessions}차시` : ""}
                  </div>
                  {req.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <span className="text-xs text-muted-foreground">준비 교구:</span>
                      {req.map((r) => (
                        <Badge key={r.id} variant="outline">
                          {r.equipment?.name ?? "교구"} × {r.quantity}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
