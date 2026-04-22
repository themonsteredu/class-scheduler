"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ParseResult } from "@/lib/schemas";

interface Props {
  existingClients: string[];
  existingInstructors: string[];
  onResult: (result: ParseResult, raw: string) => void;
}

export function KakaoPasteParser({
  existingClients,
  existingInstructors,
  onResult,
}: Props) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function runParse() {
    if (!message.trim()) {
      toast.warning("붙여넣을 원문이 필요합니다");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          existingClients,
          existingInstructors,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "AI 파싱 실패");
        return;
      }
      onResult(data.parsed as ParseResult, message);
      toast.success("자동 추출 완료 — 값을 확인해 주세요");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-xl bg-muted/30">
      <div className="flex items-center justify-between">
        <Label htmlFor="kakao-paste" className="text-sm">
          카카오톡 / 문자 원문
        </Label>
        <Button
          type="button"
          size="sm"
          onClick={runParse}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          AI로 자동 채우기
        </Button>
      </div>
      <Textarea
        id="kakao-paste"
        rows={6}
        placeholder="예: [진로코칭허브] 담주 화요일(4/29) 오전 10시-11시30분 서울 양정중 1학년 진로탐색 1반 28명, 강사료 25만원"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        붙여넣은 후 "AI로 자동 채우기"를 누르면 아래 폼이 채워집니다. 값은 모두 수정 가능합니다.
      </p>
    </div>
  );
}
