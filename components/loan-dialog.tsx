"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/date";
import { loanFormSchema, type LoanFormValues } from "@/lib/schemas";
import type { EquipmentStockRow, InstructorRow } from "@/types/database";
import { createLoan } from "@/actions/equipment";

const SELF_INSTRUCTOR = "__self__";

interface Props {
  trigger: React.ReactNode;
  equipment: Pick<EquipmentStockRow, "equipment_id" | "name" | "available">[];
  instructors: Pick<InstructorRow, "id" | "name" | "active">[];
  defaultEquipmentId?: string;
}

export function LoanDialog({
  trigger,
  equipment,
  instructors,
  defaultEquipmentId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const activeInstructors = instructors.filter((i) => i.active);

  const form = useForm<LoanFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(loanFormSchema) as any,
    defaultValues: {
      equipment_id: defaultEquipmentId ?? "",
      instructor_id: null,
      quantity: 1,
      checked_out_on: todayISO(),
      due_on: "",
      memo: "",
    },
  });

  function onSubmit(values: LoanFormValues) {
    startTransition(async () => {
      try {
        await createLoan(values);
        toast.success("대여가 등록되었습니다");
        form.reset({
          equipment_id: defaultEquipmentId ?? "",
          instructor_id: null,
          quantity: 1,
          checked_out_on: todayISO(),
          due_on: "",
          memo: "",
        });
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>교구 대여 등록</DialogTitle>
          <DialogDescription>
            강사가 교구를 가져갈 때 기록해 두면 누가 무엇을 가지고 있는지 한눈에 보입니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>교구 *</Label>
            <Controller
              control={form.control}
              name="equipment_id"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="교구 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipment.map((e) => (
                      <SelectItem key={e.equipment_id} value={e.equipment_id}>
                        {e.name} (여유 {e.available})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.equipment_id && (
              <p className="text-xs text-destructive">
                {form.formState.errors.equipment_id.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>가져가는 강사</Label>
            <Controller
              control={form.control}
              name="instructor_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? SELF_INSTRUCTOR}
                  onValueChange={(v) =>
                    field.onChange(v === SELF_INSTRUCTOR ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="강사 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELF_INSTRUCTOR}>본인 보관</SelectItem>
                    {activeInstructors.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">수량</Label>
              <Input
                id="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                {...form.register("quantity")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="checked_out_on">대여일</Label>
              <Input id="checked_out_on" type="date" {...form.register("checked_out_on")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="due_on">반납 예정</Label>
              <Input id="due_on" type="date" {...form.register("due_on")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memo">메모</Label>
            <Textarea id="memo" rows={2} placeholder="예: 3학년 진로특강용" {...form.register("memo")} />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              대여 등록
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
