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
import type { EquipmentLoanRow, EquipmentComponentRow } from "@/types/database";
import { returnLoan, deleteLoan } from "@/actions/equipment";

interface Props {
  loan: EquipmentLoanRow;
  components?: EquipmentComponentRow[];
}

export function LoanRowActions({ loan, components = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isOut = loan.status === "대여중";
  const hasComponents = components.length > 0;

  const form = useForm<LoanReturnValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(loanReturnSchema) as any,
    defaultValues: {
      returned_on: todayISO(),
      lost_damaged_qty: 0,
      condition_memo: "",
      shortages: components.map((c) => ({
        component_id: c.id,
        component_name: c.name,
        shortage_qty: 0,
        note: "",
      })),
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

            {hasComponents ? (
              <div className="flex flex-col gap-2">
                <Label>구성품별 부족·파손</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  돌아오지 않았거나 손상된 수량을 입력하세요. 해당 구성품 보유 수량에서 빠집니다.
                </p>
                <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
                  {components.map((c, i) => (
                    <div key={c.id} className="rounded-md border p-2 flex flex-col gap-1.5">
                      <input
                        type="hidden"
                        {...form.register(`shortages.${i}.component_id` as const)}
                      />
                      <input
                        type="hidden"
                        {...form.register(`shortages.${i}.component_name` as const)}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {c.name}
                          {c.unit ? ` (${c.unit})` : ""}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Label
                            htmlFor={`sh-${c.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            부족
                          </Label>
                          <Input
                            id={`sh-${c.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            className="w-20"
                            {...form.register(`shortages.${i}.shortage_qty` as const)}
                          />
                        </div>
                      </div>
                      <Input
                        placeholder="메모 (예: 날 부러짐)"
                        {...form.register(`shortages.${i}.note` as const)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
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
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="condition_memo">상태 메모</Label>
              <Textarea
                id="condition_memo"
                rows={2}
                placeholder="예: 전반적으로 양호"
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
