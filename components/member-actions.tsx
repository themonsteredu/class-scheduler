"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMember, setMemberPassword } from "@/actions/team";

export function DeleteMember({
  profileId,
  label,
}: {
  profileId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  function onDelete() {
    if (!confirm(`"${label}" 계정을 완전히 삭제할까요? 되돌릴 수 없습니다.`)) return;
    startTransition(async () => {
      try {
        await deleteMember(profileId);
        toast.success("삭제되었습니다");
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
      onClick={onDelete}
      disabled={pending}
    >
      삭제
    </Button>
  );
}

export function ResetPassword({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await setMemberPassword(profileId, pw);
        toast.success("비밀번호가 변경되었습니다");
        setPw("");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        비번 재설정
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>비밀번호 재설정</DialogTitle>
            <DialogDescription>
              새 비밀번호를 정해서 강사에게 알려주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rp">새 비밀번호 (6자 이상)</Label>
            <Input id="rp" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
