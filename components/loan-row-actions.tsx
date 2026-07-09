"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, MoreHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/date";
import { loanReturnSchema, type LoanReturnValues } from "@/lib/schemas";
import type { EquipmentLoanRow } from "@/types/database";
import { returnLoan, deleteLoan } from "@/actions/equipment";

export function LoanRowActions({ loan }: { loan: EquipmentLoanRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isOut = loan.status === "대여중";

  const form = useForm<LoanReturnValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(loanReturnSchema) as any,
    defaultValues: {
      returned_on: todayISO(),
      lost_damaged_qty: 0,
      condition_memo: "",
    },
  });

  function onReturn(values: LoanReturnValues) {
    startTransition(async () => {
      try {
        await returnLoan(loan.id, values);
        toast.success("반납 처리되었습니다");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  function onDelete() {
    if (!confirm("이 대여 기록을 삭제할까요? 되돌릴 수 없습니다.")) return;
    startTransition(async () => {
      try {
        await deleteLoan(loan.id);
        toast.success("삭제되었습니다");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      {isOut && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          반납 처리
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" disabled={pending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={onDelete}
          >
            기록 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>반납 처리</DialogTitle>
            <DialogDescription>
              {loan.equipment?.name ?? "교구"} · {loan.instructor?.name ?? "본인 보관"} · {loan.quantity}개
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onReturn)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="returned_on">반납일</Label>
              <Input id="returned_on" type="date" {...form.register("returned_on")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lost_damaged_qty">분실·파손 수량</Label>
              <Input
                id="lost_damaged_qty"
                type="number"
                inputMode="numeric"
                min={0}
                max={loan.quantity}
                {...form.register("lost_damaged_qty")}
              />
              <p className="text-xs text-muted-foreground">
                입력한 수량만큼 총 보유 수량에서 빠져 &quot;보충 필요&quot; 판단에 반영됩니다.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="condition_memo">상태 메모 (부족·손상 내용)</Label>
              <Textarea
                id="condition_memo"
                rows={2}
                placeholder="예: 카드 3장 분실, 상자 찢어짐"
                {...form.register("condition_memo")}
              />
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                반납 완료
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
