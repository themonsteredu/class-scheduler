import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const { user, profile } = await getProfile();
  if (!user) redirect("/login");
  if (profile?.role === "admin") redirect("/");
  if (profile?.role === "instructor" && profile.instructor_id) redirect("/me");

  const setupNeeded = !profile;

  return (
    <div className="min-h-svh flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{setupNeeded ? "설정이 필요해요" : "승인 대기 중"}</CardTitle>
          <CardDescription>
            {setupNeeded
              ? "역할 설정(profiles) 마이그레이션이 아직 실행되지 않았어요. Supabase에서 0006 SQL을 실행하면 사장님 계정이 관리자로 지정됩니다."
              : "회원가입이 접수되었습니다. 사장님이 승인하면 본인 스케쥴·수입·교구를 볼 수 있어요."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {user.email}
            {profile?.display_name ? ` · ${profile.display_name}` : ""}
          </p>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
