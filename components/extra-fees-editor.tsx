"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExtraFee } from "@/lib/schemas";

interface Props {
  value: ExtraFee[];
  onChange: (next: ExtraFee[]) => void;
}

const PAID_TO_LABEL: Record<ExtraFee["paid_to"], string> = {
  me: "본인(수입)",
  instructor: "강사(지출)",
  client: "업체(지출)",
};

export function ExtraFeesEditor({ value, onChange }: Props) {
  function update(index: number, patch: Partial<ExtraFee>) {
    const next = value.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  }
  function add() {
    onChange([...value, { label: "", amount: 0, paid_to: "me" }]);
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 && (
        <div className="text-xs text-muted-foreground">
          부가 항목이 없습니다. "항목 추가"를 눌러 교통비·자료비 등을 기록할 수 있습니다.
        </div>
      )}
      {value.map((item, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_140px_160px_auto] gap-2 items-center">
          <Input
            placeholder="항목 (예: 교통비)"
            value={item.label}
            onChange={(e) => update(idx, { label: e.target.value })}
          />
          <Input
            type="number"
            inputMode="numeric"
            placeholder="금액"
            value={item.amount ?? ""}
            onChange={(e) =>
              update(idx, {
                amount: e.target.value === "" ? 0 : Number(e.target.value),
              })
            }
          />
          <Select
            value={item.paid_to}
            onValueChange={(v) =>
              update(idx, { paid_to: v as ExtraFee["paid_to"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["me", "instructor", "client"] as const).map((key) => (
                <SelectItem key={key} value={key}>
                  {PAID_TO_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => remove(idx)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" /> 항목 추가
        </Button>
      </div>
    </div>
  );
}
