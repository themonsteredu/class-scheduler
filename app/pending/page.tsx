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

  const connectionFailed = !profile;

  return (
    <div className="min-h-svh flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{connectionFailed ? "계정 연결을 확인해 주세요" : "승인 대기 중"}</CardTitle>
          <CardDescription>
            {connectionFailed
              ? "스케줄러 계정을 연결하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요."
              : "강사 가입 요청이 접수되었습니다. 원장님이 승인하면 배정된 수업·수입·교구를 확인할 수 있어요."}
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
