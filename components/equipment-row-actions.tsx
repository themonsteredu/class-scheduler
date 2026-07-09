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
import { EquipmentDialog } from "@/components/equipment-dialog";
import type { EquipmentRow } from "@/types/database";
import { deleteEquipment, updateEquipment } from "@/actions/equipment";

export function EquipmentRowActions({ equipment }: { equipment: EquipmentRow }) {
  const [pending, startTransition] = useTransition();

  function onToggleActive() {
    startTransition(async () => {
      try {
        await updateEquipment(equipment.id, {
          name: equipment.name,
          category: equipment.category ?? "",
          total_quantity: equipment.total_quantity,
          low_stock_threshold: equipment.low_stock_threshold,
          memo: equipment.memo ?? "",
          active: !equipment.active,
        });
        toast.success(equipment.active ? "숨김 처리되었습니다" : "다시 사용합니다");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  function onDelete() {
    if (
      !confirm(
        `"${equipment.name}" 교구를 삭제할까요? 관련 대여 기록도 함께 삭제됩니다. 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteEquipment(equipment.id);
        toast.success("삭제되었습니다");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <div className="flex justify-end">
      <EquipmentDialog
        equipment={equipment}
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
            {equipment.active ? "숨기기" : "다시 사용"}
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
