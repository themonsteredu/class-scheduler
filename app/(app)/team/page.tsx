import { requireAdmin } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApproveMember } from "@/components/approve-member";
import { RevokeMember } from "@/components/revoke-member";
import type { ProfileRow, InstructorRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { supabase, user } = await requireAdmin();

  const [{ data: profileData }, { data: instructorData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .neq("id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("instructors")
      .select("id,name")
      .eq("user_id", user.id)
      .order("name"),
  ]);

  const profiles = (profileData ?? []) as ProfileRow[];
  const instructors = (instructorData ?? []) as Pick<InstructorRow, "id" | "name">[];
  const instructorName = new Map(instructors.map((i) => [i.id, i.name]));

  const pending = profiles.filter((p) => p.role === "pending");
  const members = profiles.filter((p) => p.role === "instructor");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">강사 계정</h1>
        <p className="text-sm text-muted-foreground mt-1">
          강사가 회원가입하면 여기서 승인하고 강사 명단과 연결하세요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>승인 대기 {pending.length > 0 && `(${pending.length})`}</CardTitle>
          <CardDescription>
            승인하면 해당 강사가 본인 스케쥴·수입·교구를 볼 수 있어요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              승인 대기 중인 가입자가 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{p.display_name ?? p.email}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </div>
                  <ApproveMember
                    profileId={p.id}
                    defaultName={p.display_name ?? ""}
                    instructors={instructors}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>승인된 강사 계정</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              아직 승인된 강사 계정이 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {members.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{p.display_name ?? p.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.email}
                      {p.instructor_id && instructorName.get(p.instructor_id)
                        ? ` · ${instructorName.get(p.instructor_id)} 연결됨`
                        : " · 연결된 강사 없음"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="success">강사</Badge>
                    <RevokeMember profileId={p.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
