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
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [link, setLink] = useState(NEW);

  function submit() {
    startTransition(async () => {
      try {
        await createInstructorAccount({
          email,
          password,
          name,
          instructorId: link === NEW ? null : link,
        });
        toast.success("강사 계정이 생성되었습니다");
        setEmail("");
        setPassword("");
        setName("");
        setLink(NEW);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" /> 강사 계정 만들기
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>강사 계정 만들기</DialogTitle>
          <DialogDescription>
            이메일과 비밀번호를 정해서 만들면 강사는 이메일 인증 없이 바로 로그인할 수 있어요.
            만든 이메일·비밀번호를 강사에게 알려주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cm-email">이메일 (아이디)</Label>
            <Input
              id="cm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="instructor@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cm-pw">비밀번호 (6자 이상)</Label>
            <Input
              id="cm-pw"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="강사에게 알려줄 임시 비밀번호"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cm-name">강사 이름</Label>
            <Input
              id="cm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>강사 명단 연결</Label>
            <Select value={link} onValueChange={setLink}>
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
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            만들기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
