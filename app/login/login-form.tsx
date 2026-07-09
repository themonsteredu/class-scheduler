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

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          toast.error(error.message);
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
        toast.error(error.message);
        return;
      }
      toast.success("로그인 성공");
      router.replace(next || "/");
      router.refresh();
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
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {isSignup && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                autoComplete="name"
                required
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSignup ? "회원가입" : "로그인"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(isSignup ? "login" : "signup")}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground underline w-full text-center"
        >
          {isSignup ? "이미 계정이 있어요 · 로그인" : "강사이신가요? 회원가입"}
        </button>
      </CardContent>
    </Card>
  );
}
