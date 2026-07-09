"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { EquipmentComponentRow } from "@/types/database";
import {
  createComponent,
  updateComponent,
  deleteComponent,
} from "@/actions/equipment";

interface Props {
  trigger: React.ReactNode;
  equipment: { id: string; name: string };
  components: EquipmentComponentRow[];
}

export function EquipmentComponentsDialog({ trigger, equipment, components }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{equipment.name} · 구성품</DialogTitle>
          <DialogDescription>
            부품별 보유 수량과 보충 기준을 관리합니다. 보유가 기준 이하면 &quot;보충 필요&quot;로 표시됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto pr-1">
          {components.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              등록된 구성품이 없습니다. 아래에서 추가하세요.
            </div>
          ) : (
            components.map((c) => <ComponentRow key={c.id} component={c} />)
          )}
        </div>

        <AddComponentForm equipmentId={equipment.id} />
      </DialogContent>
    </Dialog>
  );
}

function ComponentRow({ component }: { component: EquipmentComponentRow }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(component.name);
  const [unit, setUnit] = useState(component.unit ?? "");
  const [total, setTotal] = useState(String(component.total_quantity));
  const [threshold, setThreshold] = useState(String(component.low_stock_threshold));

  const needsRestock = Number(total) <= Number(threshold);
  const dirty =
    name !== component.name ||
    unit !== (component.unit ?? "") ||
    Number(total) !== component.total_quantity ||
    Number(threshold) !== component.low_stock_threshold;

  function onSave() {
    startTransition(async () => {
      try {
        await updateComponent(component.id, {
          name,
          unit,
          total_quantity: total,
          low_stock_threshold: threshold,
        });
        toast.success("저장되었습니다");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  function onDelete() {
    if (!confirm(`구성품 "${component.name}"을(를) 삭제할까요?`)) return;
    startTransition(async () => {
      try {
        await deleteComponent(component.id);
        toast.success("삭제되었습니다");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <div className="rounded-md border p-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
          placeholder="구성품명"
        />
        {needsRestock ? (
          <Badge variant="destructive">보충 필요</Badge>
        ) : (
          <Badge variant="success">충분</Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">단위</Label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="개/장" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">보유</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">보충 기준</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 className="h-4 w-4" /> 삭제
        </Button>
        <Button size="sm" onClick={onSave} disabled={pending || !dirty}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} 저장
        </Button>
      </div>
    </div>
  );
}

function AddComponentForm({ equipmentId }: { equipmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [total, setTotal] = useState("0");
  const [threshold, setThreshold] = useState("0");

  function onAdd() {
    if (!name.trim()) {
      toast.error("구성품명을 입력하세요");
      return;
    }
    startTransition(async () => {
      try {
        await createComponent(equipmentId, {
          name,
          unit,
          total_quantity: total,
          low_stock_threshold: threshold,
        });
        toast.success("구성품이 추가되었습니다");
        setName("");
        setUnit("");
        setTotal("0");
        setThreshold("0");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <div className="rounded-md border border-dashed p-2 flex flex-col gap-2">
      <div className="text-xs font-medium text-muted-foreground">구성품 추가</div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="구성품명 (예: 가위)" />
        <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="단위 (예: 개)" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">보유 수량</Label>
          <Input type="number" inputMode="numeric" min={0} value={total} onChange={(e) => setTotal(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">보충 기준</Label>
          <Input type="number" inputMode="numeric" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onAdd} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} 추가
        </Button>
      </div>
    </div>
  );
}
