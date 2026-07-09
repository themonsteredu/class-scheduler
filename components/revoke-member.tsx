"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revokeMember } from "@/actions/team";

export function RevokeMember({ profileId }: { profileId: string }) {
  const [pending, startTransition] = useTransition();

  function revoke() {
    if (!confirm("이 강사의 계정 연결을 해제할까요? (다시 승인 대기 상태가 됩니다)")) return;
    startTransition(async () => {
      try {
        await revokeMember(profileId);
        toast.success("연결이 해제되었습니다");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      onClick={revoke}
      disabled={pending}
    >
      연결 해제
    </Button>
  );
}
