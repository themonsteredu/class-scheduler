"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function authErrorMessage(error: unknown) {
  const detail =
    error && typeof error === "object"
      ? (error as { code?: string; name?: string; message?: string; status?: number })
      : {};

  if (detail.code === "invalid_credentials") {
    return "이메일 또는 비밀번호가 맞지 않습니다. 다시 확인해 주세요.";
  }
  if (detail.code === "email_not_confirmed") {
    return "이메일 인증을 완료한 뒤 다시 로그인해 주세요.";
  }
  if (
    detail.status === 429 ||
    (typeof detail.code === "string" && detail.code.startsWith("over_"))
  ) {
    return "요청이 많습니다. 잠시 기다린 뒤 다시 시도해 주세요.";
  }
  if (detail.code === "user_already_exists") {
    return "이미 가입된 이메일입니다. 로그인해 주세요.";
  }
  if (detail.code === "signup_disabled") {
    return "현재 회원가입을 받을 수 없습니다. 관리자에게 알려 주세요.";
  }
  if (detail.message === "AUTH_REQUEST_TIMEOUT") {
    return "로그인 서버의 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요. 계속되면 관리자에게 알려 주세요.";
  }
  if (
    detail.name === "AuthRetryableFetchError" ||
    detail.name === "AbortError" ||
    (detail.status !== undefined && detail.status >= 500) ||
    /fetch|network|load failed|timeout/i.test(detail.message ?? "")
  ) {
    return "로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요. 계속되면 관리자에게 알려 주세요.";
  }
  return "요청을 처리하지 못했습니다. 다시 시도해 주세요. 계속되면 관리자에게 알려 주세요.";
}

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name } },
        });
        if (error) {
          setErrorMessage(authErrorMessage(error));
          return;
        }
        // 이메일 확인이 꺼져 있으면 바로 세션 생성됨 → 승인 대기 페이지로.
        if (data.session) {
          toast.success("가입 완료! 사장님 승인을 기다려 주세요.");
          router.replace("/pending");
          router.refresh();
        } else {
          toast.success("가입 요청됨. 이메일 확인 후 로그인하면 승인 대기 상태가 됩니다.");
          setMode("login");
        }
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErrorMessage(authErrorMessage(error));
        return;
      }
      toast.success("로그인 성공");
      router.replace(next || "/");
      router.refresh();
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>수업 스케줄러</CardTitle>
        <CardDescription>
          {isSignup
            ? "강사 회원가입 — 가입 후 사장님 승인이 필요합니다."
            : "로그인해서 시작하세요."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-busy={loading}>
          {isSignup && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                disabled={loading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              disabled={loading}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {errorMessage && (
            <p
              role="alert"
              className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm leading-relaxed text-destructive break-keep"
            >
              {errorMessage}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading
              ? isSignup ? "가입 요청 중…" : "로그인 중…"
              : isSignup ? "회원가입" : "로그인"}
          </Button>
        </form>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setErrorMessage(null);
            setMode(isSignup ? "login" : "signup");
          }}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground underline w-full text-center"
        >
          {isSignup ? "이미 계정이 있어요 · 로그인" : "강사이신가요? 회원가입"}
        </button>
      </CardContent>
    </Card>
  );
}
