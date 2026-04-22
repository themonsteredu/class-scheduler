"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { instructorFormSchema, type InstructorFormValues } from "@/lib/schemas";
import type { InstructorRow } from "@/types/database";
import { createInstructor, updateInstructor } from "@/actions/instructors";

interface Props {
  trigger: React.ReactNode;
  instructor?: InstructorRow;
}

export function InstructorDialog({ trigger, instructor }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(instructor);

  const form = useForm<InstructorFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(instructorFormSchema) as any,
    defaultValues: {
      name: instructor?.name ?? "",
      phone: instructor?.phone ?? "",
      email: instructor?.email ?? "",
      subjects: instructor?.subjects?.join(", ") ?? "",
      default_payout: instructor?.default_payout ?? null,
      bank_account: instructor?.bank_account ?? "",
      memo: instructor?.memo ?? "",
      active: instructor?.active ?? true,
    },
  });

  function onSubmit(values: InstructorFormValues) {
    startTransition(async () => {
      try {
        if (isEdit && instructor) {
          await updateInstructor(instructor.id, values);
          toast.success("강사 정보가 수정되었습니다");
        } else {
          await createInstructor(values);
          toast.success("강사가 추가되었습니다");
          form.reset({
            name: "",
            phone: "",
            email: "",
            subjects: "",
            default_payout: null,
            bank_account: "",
            memo: "",
            active: true,
          });
        }
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        toast.error(msg);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "강사 수정" : "강사 추가"}</DialogTitle>
          <DialogDescription>
            이름 외 항목은 모두 선택입니다.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">이름 *</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">연락처</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" type="email" {...form.register("email")} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subjects">담당 과목 (쉼표 구분)</Label>
            <Input
              id="subjects"
              placeholder="진로탐색, 진로특강"
              {...form.register("subjects")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="default_payout">기본 강사료</Label>
              <Input
                id="default_payout"
                type="number"
                inputMode="numeric"
                {...form.register("default_payout")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bank_account">계좌</Label>
              <Input id="bank_account" {...form.register("bank_account")} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memo">메모</Label>
            <Textarea id="memo" rows={3} {...form.register("memo")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("active")} />
            활성 강사
          </label>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
