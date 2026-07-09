"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approveMember } from "@/actions/team";

const NEW = "__new__";

export function ApproveMember({
  profileId,
  defaultName,
  instructors,
}: {
  profileId: string;
  defaultName: string;
  instructors: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<string>(NEW);
  const [newName, setNewName] = useState(defaultName);

  function approve() {
    startTransition(async () => {
      try {
        if (choice === NEW) {
          await approveMember(profileId, { newName });
        } else {
          await approveMember(profileId, { instructorId: choice });
        }
        toast.success("승인되었습니다");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select value={choice} onValueChange={setChoice}>
        <SelectTrigger className="sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NEW}>+ 새 강사로 등록</SelectItem>
          {instructors.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {choice === NEW && (
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="강사 이름"
          className="sm:w-36"
        />
      )}
      <Button size="sm" onClick={approve} disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        승인
      </Button>
    </div>
  );
}
