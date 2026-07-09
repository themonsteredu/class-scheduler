"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { ProgramEquipmentRow } from "@/types/database";
import {
  addProgramEquipment,
  deleteProgramEquipment,
} from "@/actions/program-equipment";

interface Props {
  trigger: React.ReactNode;
  mappings: ProgramEquipmentRow[];
  equipment: { id: string; name: string }[];
  programNames: string[]; // 기존 과목명 제안
}

export function ProgramEquipmentManager({
  trigger,
  mappings,
  equipment,
  programNames,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [program, setProgram] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [qty, setQty] = useState("1");

  // group mappings by program name
  const byProgram = new Map<string, ProgramEquipmentRow[]>();
  for (const m of mappings) {
    const arr = byProgram.get(m.program_name) ?? [];
    arr.push(m);
    byProgram.set(m.program_name, arr);
  }
  const programs = [...byProgram.keys()].sort();

  function onAdd() {
    if (!program.trim()) return toast.error("프로그램(과목) 이름을 입력하세요");
    if (!equipmentId) return toast.error("교구를 선택하세요");
    startTransition(async () => {
      try {
        await addProgramEquipment(program.trim(), equipmentId, Number(qty) || 1);
        toast.success("교구가 연결되었습니다");
        setEquipmentId("");
        setQty("1");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteProgramEquipment(id);
        toast.success("연결이 해제되었습니다");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>프로그램별 교구 설정</DialogTitle>
          <DialogDescription>
            프로그램(과목) 이름마다 필요한 교구를 지정해두면, 그 과목 수업이 잡힐 때마다
            요일별 스케쥴에 자동으로 반영됩니다. (수업의 &quot;과목&quot; 이름과 정확히 일치해야 해요.)
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 max-h-[45vh] overflow-y-auto pr-1">
          {programs.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              아직 설정된 프로그램이 없습니다. 아래에서 추가하세요.
            </div>
          ) : (
            programs.map((p) => (
              <div key={p} className="rounded-md border p-2">
                <div className="text-sm font-medium mb-1.5">{p}</div>
                <div className="flex flex-col gap-1">
                  {byProgram.get(p)!.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        {m.equipment?.name ?? "(삭제된 교구)"}
                        <span className="text-muted-foreground"> × {m.quantity}</span>
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete(m.id)}
                        disabled={pending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-md border border-dashed p-2 flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground">교구 연결 추가</div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pe-program">프로그램(과목) 이름</Label>
            <Input
              id="pe-program"
              list="pe-programs"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="예: 진로탐색"
            />
            <datalist id="pe-programs">
              {programNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div className="flex flex-col gap-1.5">
              <Label>교구</Label>
              <Select value={equipmentId} onValueChange={setEquipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="교구 선택" />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 w-20">
              <Label htmlFor="pe-qty">수량</Label>
              <Input
                id="pe-qty"
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={onAdd} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              추가
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
