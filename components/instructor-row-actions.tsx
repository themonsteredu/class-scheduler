"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { InstructorDialog } from "@/components/instructor-dialog";
import type { InstructorRow } from "@/types/database";
import { deleteInstructor, toggleInstructorActive } from "@/actions/instructors";

export function InstructorRowActions({ instructor }: { instructor: InstructorRow }) {
  const [pending, startTransition] = useTransition();

  function onToggleActive() {
    startTransition(async () => {
      try {
        await toggleInstructorActive(instructor.id, !instructor.active);
        toast.success(instructor.active ? "비활성화 되었습니다" : "활성화 되었습니다");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        toast.error(msg);
      }
    });
  }

  function onDelete() {
    if (!confirm(`"${instructor.name}" 강사를 정말 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteInstructor(instructor.id);
        toast.success("삭제되었습니다");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        toast.error(msg);
      }
    });
  }

  return (
    <div className="flex justify-end">
      <InstructorDialog
        instructor={instructor}
        trigger={
          <Button size="sm" variant="ghost">
            수정
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" disabled={pending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onToggleActive}>
            {instructor.active ? "비활성화" : "활성화"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={onDelete}
          >
            삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
