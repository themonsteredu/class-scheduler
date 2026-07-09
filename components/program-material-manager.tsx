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
import { fmtMaterialRule } from "@/lib/pricing";
import type { ProgramMaterialFeeRow } from "@/types/database";
import {
  setProgramMaterialFee,
  deleteProgramMaterialFee,
} from "@/actions/program-material";

interface Props {
  trigger: React.ReactNode;
  materialFees: ProgramMaterialFeeRow[];
  programNames: string[];
}

export function ProgramMaterialManager({
  trigger,
  materialFees,
  programNames,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [program, setProgram] = useState("");
  const [feeType, setFeeType] = useState<"fixed" | "per_person">("fixed");
  const [amount, setAmount] = useState("");

  function onSave() {
    if (!program.trim()) return toast.error("프로그램(과목) 이름을 입력하세요");
    startTransition(async () => {
      try {
        await setProgramMaterialFee(program.trim(), feeType, Number(amount) || 0);
        toast.success("재료비 규칙이 저장되었습니다");
        setProgram("");
        setAmount("");
        setFeeType("fixed");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteProgramMaterialFee(id);
        toast.success("삭제되었습니다");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  const sorted = [...materialFees].sort((a, b) =>
    a.program_name.localeCompare(b.program_name),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>프로그램별 재료비 규칙</DialogTitle>
          <DialogDescription>
            프로그램(과목)마다 재료비를 정해두면 수업 등록 시 자동으로 내 수입에 반영됩니다.
            (예: 로봇·드론·모션 = 수업당 50,000원, 3D펜 = 인당 5,000원)
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
          {sorted.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              아직 규칙이 없습니다. 아래에서 추가하세요.
            </div>
          ) : (
            sorted.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <div>
                  <span className="font-medium">{m.program_name}</span>
                  <span className="text-muted-foreground"> · {fmtMaterialRule(m)}</span>
                </div>
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
            ))
          )}
        </div>

        <div className="rounded-md border border-dashed p-2 flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground">
            규칙 추가 / 수정
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-program">프로그램(과목) 이름</Label>
            <Input
              id="pm-program"
              list="pm-programs"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="예: 로봇"
            />
            <datalist id="pm-programs">
              {programNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>방식</Label>
              <Select
                value={feeType}
                onValueChange={(v) => setFeeType(v as "fixed" | "per_person")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">수업당 고정</SelectItem>
                  <SelectItem value="per_person">인당</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-amount">금액(원)</Label>
              <Input
                id="pm-amount"
                type="number"
                inputMode="numeric"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={feeType === "per_person" ? "5000" : "50000"}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={onSave} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              저장
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
