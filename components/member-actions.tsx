"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteMember } from "@/actions/team";

export function DeleteMember({
  profileId,
  label,
}: {
  profileId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  function onDelete() {
    if (pending) return;
    if (!confirm(`"${label}" 님을 스케줄러 회원 목록에서 삭제할까요? MOAKIT 계정은 유지됩니다.`)) return;
    startTransition(async () => {
      try {
        await deleteMember(profileId);
        toast.success("스케줄러 회원 목록에서 삭제했습니다");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "삭제하지 못했습니다");
      }
    });
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      onClick={onDelete}
      disabled={pending}
    >
      {pending ? "삭제 중…" : "회원 삭제"}
    </Button>
  );
}
