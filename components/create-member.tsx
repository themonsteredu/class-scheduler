"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInstructorAccount } from "@/actions/team";

const NEW = "__new__";

export function CreateMember({
  instructors,
}: {
  instructors: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [link, setLink] = useState(NEW);

  function submit() {
    if (pending) return;
    startTransition(async () => {
      try {
        await createInstructorAccount({
          email,
          name,
          instructorId: link === NEW ? null : link,
        });
        toast.success("강사 계정을 연결했습니다");
        setEmail("");
        setName("");
        setLink(NEW);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" /> 강사 계정 연결
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>강사 계정 연결</DialogTitle>
          <DialogDescription>
            가입과 이메일 인증을 마친 MOAKIT 계정을 강사 명단에 연결하세요.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cm-email">MOAKIT 이메일</Label>
            <Input
              id="cm-email"
              type="email"
              autoComplete="email"
              required
              disabled={pending}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="instructor@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cm-name">강사 이름</Label>
            <Input
              id="cm-name"
              autoComplete="name"
              required={link === NEW}
              disabled={pending}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>강사 명단 연결</Label>
            <Select value={link} onValueChange={setLink} disabled={pending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW}>+ 새 강사로 등록 (위 이름으로)</SelectItem>
                {instructors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "연결 중…" : "연결하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
