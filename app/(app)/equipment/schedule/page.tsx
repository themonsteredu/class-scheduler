import Link from "next/link";
import { ChevronLeft, ChevronRight, Settings2, Package, ArrowLeft } from "lucide-react";
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
import { ProgramEquipmentManager } from "@/components/program-equipment-manager";
import {
  todayISO,
  weekStartISO,
  weekDaysISO,
  addDaysISO,
  weekdayKO,
  fmtDate,
} from "@/lib/date";
import type {
  ClassRequestRow,
  ProgramEquipmentRow,
  EquipmentRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function EquipmentSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;

  const base = params.week && ISO_RE.test(params.week) ? params.week : todayISO();
  const monday = weekStartISO(base);
  const days = weekDaysISO(monday);
  const weekEndExclusive = addDaysISO(monday, 7);
  const sunday = days[6];

  const [
    { data: classData },
    { data: mappingData },
    { data: equipmentData },
    { data: subjectData },
  ] = await Promise.all([
    supabase
      .from("class_requests")
      .select("id, class_date, start_time, subject, school_name, instructor:instructors(name)")
      .eq("user_id", user.id)
      .gte("class_date", monday)
      .lt("class_date", weekEndExclusive)
      .neq("status", "취소")
      .order("class_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("program_equipment")
      .select("*, equipment:equipment(id,name,total_quantity)")
      .eq("user_id", user.id),
    supabase
      .from("equipment")
      .select("id, name, total_quantity, active")
      .eq("user_id", user.id)
      .order("active", { ascending: false })
      .order("name", { ascending: true }),
    supabase.from("class_requests").select("subject").eq("user_id", user.id),
  ]);

  const classes = (classData ?? []) as unknown as ClassRequestRow[];
  const mappings = (mappingData ?? []) as unknown as ProgramEquipmentRow[];
  const equipment = (equipmentData ?? []) as Pick<
    EquipmentRow,
    "id" | "name" | "total_quantity" | "active"
  >[];

  // program name -> required equipment
  const mapByProgram = new Map<string, ProgramEquipmentRow[]>();
  for (const m of mappings) {
    const arr = mapByProgram.get(m.program_name) ?? [];
    arr.push(m);
    mapByProgram.set(m.program_name, arr);
  }
  const totalById = new Map(equipment.map((e) => [e.id, e.total_quantity]));

  // program name suggestions (mappings + all class subjects)
  const programNames = [
    ...new Set(
      [
        ...mappings.map((m) => m.program_name),
        ...((subjectData ?? []) as { subject: string | null }[])
          .map((s) => s.subject)
          .filter((s): s is string => Boolean(s)),
      ].map((s) => s.trim()),
    ),
  ].sort();

  // classes grouped by day
  const classesByDay = new Map<string, ClassRequestRow[]>();
  for (const c of classes) {
    if (!c.class_date) continue;
    const arr = classesByDay.get(c.class_date) ?? [];
    arr.push(c);
    classesByDay.set(c.class_date, arr);
  }

  // required equipment for a class (by its subject/program)
  function requiredFor(c: ClassRequestRow): ProgramEquipmentRow[] {
    if (!c.subject) return [];
    return mapByProgram.get(c.subject.trim()) ?? [];
  }

  // weekly totals
  const weeklyNeed = new Map<string, { name: string; needed: number }>();
  for (const c of classes) {
    for (const r of requiredFor(c)) {
      const cur = weeklyNeed.get(r.equipment_id) ?? {
        name: r.equipment?.name ?? "교구",
        needed: 0,
      };
      cur.needed += r.quantity;
      weeklyNeed.set(r.equipment_id, cur);
    }
  }
  const weeklyList = [...weeklyNeed.entries()]
    .map(([id, v]) => ({
      id,
      name: v.name,
      needed: v.needed,
      have: totalById.get(id) ?? 0,
    }))
    .sort((a, b) => b.needed - a.needed);

  const today = todayISO();
  const prevWeek = addDaysISO(monday, -7);
  const nextWeek = addDaysISO(monday, 7);
  const hasMappings = mappings.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href="/equipment"
              className="text-muted-foreground hover:text-foreground"
              aria-label="교구로"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              요일별 교구 스케쥴
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {fmtDate(monday)} ~ {fmtDate(sunday)} · 수업 {classes.length}건
          </p>
        </div>
        <ProgramEquipmentManager
          mappings={mappings}
          equipment={equipment.filter((e) => e.active).map((e) => ({ id: e.id, name: e.name }))}
          programNames={programNames}
          trigger={
            <Button size="sm" variant="outline">
              <Settings2 className="h-4 w-4" /> 프로그램별 교구 설정
            </Button>
          }
        />
      </div>

      {/* week nav */}
      <div className="flex items-center justify-between gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/equipment/schedule?week=${prevWeek}`}>
            <ChevronLeft className="h-4 w-4" /> 지난주
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/equipment/schedule">이번 주</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/equipment/schedule?week=${nextWeek}`}>
            다음주 <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {!hasMappings && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            아직 프로그램(과목)에 교구를 연결하지 않았어요. 우측 상단{" "}
            <span className="font-medium text-foreground">&quot;프로그램별 교구 설정&quot;</span>{" "}
            에서 &quot;진로탐색 → 진로카드 세트&quot; 처럼 지정하면, 이 화면에 요일별로 필요한 교구가 자동으로 뜹니다.
          </CardContent>
        </Card>
      )}

      {/* weekly total */}
      {weeklyList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" /> 이번 주 교구 준비 합계
            </CardTitle>
            <CardDescription>
              이 주 수업들에 필요한 교구 수량입니다. 보유보다 많이 필요하면 빨갛게 표시돼요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {weeklyList.map((w) => {
                const short = w.needed > w.have;
                return (
                  <Badge key={w.id} variant={short ? "destructive" : "secondary"}>
                    {w.name} {w.needed}
                    {short ? ` / 보유 ${w.have} 부족` : ""}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* per-day */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {days.map((d) => {
          const dayClasses = classesByDay.get(d) ?? [];
          const isToday = d === today;
          // per-day equipment subtotal
          const dayNeed = new Map<string, { name: string; qty: number }>();
          for (const c of dayClasses) {
            for (const r of requiredFor(c)) {
              const cur = dayNeed.get(r.equipment_id) ?? {
                name: r.equipment?.name ?? "교구",
                qty: 0,
              };
              cur.qty += r.quantity;
              dayNeed.set(r.equipment_id, cur);
            }
          }
          return (
            <Card key={d} className={isToday ? "border-primary/50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>
                    {weekdayKO(d)}요일{" "}
                    <span className="text-muted-foreground font-normal">{fmtDate(d, "M/d")}</span>
                    {isToday && <span className="text-primary"> · 오늘</span>}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    수업 {dayClasses.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {dayClasses.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">수업 없음</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayClasses.map((c) => {
                      const req = requiredFor(c);
                      return (
                        <div key={c.id} className="border-b last:border-b-0 pb-2 last:pb-0">
                          <div className="text-sm font-medium">
                            {c.start_time ? `${c.start_time.slice(0, 5)} ` : ""}
                            {c.school_name ?? "(학교 미정)"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.subject ?? "과목 미정"}
                            {c.instructor?.name ? ` · ${c.instructor.name}` : ""}
                          </div>
                          {req.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {req.map((r) => (
                                <Badge key={r.id} variant="outline">
                                  {r.equipment?.name ?? "교구"} × {r.quantity}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            c.subject && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                연결된 교구 없음
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}

                    {dayNeed.size > 0 && (
                      <div className="text-xs text-muted-foreground pt-1">
                        준비:{" "}
                        {[...dayNeed.values()]
                          .map((v) => `${v.name} ${v.qty}`)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
