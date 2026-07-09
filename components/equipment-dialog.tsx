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
import { equipmentFormSchema, type EquipmentFormValues } from "@/lib/schemas";
import type { EquipmentRow } from "@/types/database";
import { createEquipment, updateEquipment } from "@/actions/equipment";

interface Props {
  trigger: React.ReactNode;
  equipment?: EquipmentRow;
}

export function EquipmentDialog({ trigger, equipment }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(equipment);

  const form = useForm<EquipmentFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(equipmentFormSchema) as any,
    defaultValues: {
      name: equipment?.name ?? "",
      category: equipment?.category ?? "",
      total_quantity: equipment?.total_quantity ?? 1,
      low_stock_threshold: equipment?.low_stock_threshold ?? 0,
      memo: equipment?.memo ?? "",
      active: equipment?.active ?? true,
    },
  });

  function onSubmit(values: EquipmentFormValues) {
    startTransition(async () => {
      try {
        if (isEdit && equipment) {
          await updateEquipment(equipment.id, values);
          toast.success("교구가 수정되었습니다");
        } else {
          await createEquipment(values);
          toast.success("교구가 추가되었습니다");
          form.reset({
            name: "",
            category: "",
            total_quantity: 1,
            low_stock_threshold: 0,
            memo: "",
            active: true,
          });
        }
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
          <DialogTitle>{isEdit ? "교구 수정" : "교구 추가"}</DialogTitle>
          <DialogDescription>
            보충 기준 수량 이하로 남으면 목록에 &quot;보충 필요&quot;로 표시됩니다.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">교구명 *</Label>
            <Input id="name" placeholder="예: 진로카드 세트" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">분류</Label>
            <Input id="category" placeholder="예: 보드게임, 키트" {...form.register("category")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="total_quantity">총 보유 수량</Label>
              <Input
                id="total_quantity"
                type="number"
                inputMode="numeric"
                min={0}
                {...form.register("total_quantity")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="low_stock_threshold">보충 기준 수량</Label>
              <Input
                id="low_stock_threshold"
                type="number"
                inputMode="numeric"
                min={0}
                {...form.register("low_stock_threshold")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memo">메모</Label>
            <Textarea id="memo" rows={3} {...form.register("memo")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("active")} />
            사용 중인 교구
          </label>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
