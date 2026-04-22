import { Suspense } from "react";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Suspense fallback={<div className="text-sm text-muted-foreground">불러오는 중…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
