import { requireAdmin } from "@/lib/supabase/server";
import { isAdminConfigured } from "@/lib/supabase/admin";
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
import { CreateMember } from "@/components/create-member";
import { DeleteMember, ResetPassword } from "@/components/member-actions";
import type { ProfileRow, InstructorRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { supabase, user } = await requireAdmin();
  const adminReady = isAdminConfigured();

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

  const members = profiles.filter((p) => p.role === "instructor");
  const toApprove = profiles.filter((p) => p.role !== "instructor");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">강사 계정</h1>
          <p className="text-sm text-muted-foreground mt-1">
            강사 계정을 직접 만들거나(이메일 인증 없이 바로 사용), 가입한 강사를 승인하세요.
          </p>
        </div>
        <CreateMember instructors={instructors} />
      </div>

      {!adminReady && (
        <Card className="border-amber-500/40">
          <CardContent className="py-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">설정 필요:</span> 강사 계정 직접 생성·삭제·비번
            재설정을 쓰려면 Vercel 환경변수에 <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> 를
            추가하고 재배포해야 해요. (Supabase → Project Settings → API → service_role 키)
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>승인 대기 · 미승인 {toApprove.length > 0 && `(${toApprove.length})`}</CardTitle>
          <CardDescription>
            승인하면 강사로 전환되고, 이메일 확인 없이 바로 로그인할 수 있어요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {toApprove.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              대기 중인 계정이 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {toApprove.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 rounded-md border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{p.display_name ?? p.email}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.role === "admin" && <Badge variant="muted">관리자</Badge>}
                      <DeleteMember profileId={p.id} label={p.display_name ?? p.email ?? "계정"} />
                    </div>
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
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
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
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="success">강사</Badge>
                    <ResetPassword profileId={p.id} />
                    <RevokeMember profileId={p.id} />
                    <DeleteMember profileId={p.id} label={p.display_name ?? p.email ?? "계정"} />
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
