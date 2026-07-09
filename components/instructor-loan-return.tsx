"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/date";
import type { EquipmentLoanRow, EquipmentComponentRow } from "@/types/database";
import { instructorReturnLoan } from "@/actions/instructor";

export function InstructorLoanReturn({
  loan,
  components,
}: {
  loan: EquipmentLoanRow;
  components: EquipmentComponentRow[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [returnedOn, setReturnedOn] = useState(todayISO());
  const [memo, setMemo] = useState("");
  const [shortages, setShortages] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  function submit() {
    startTransition(async () => {
      try {
        const sh = components
          .map((c) => ({
            component_id: c.id,
            component_name: c.name,
            shortage_qty: Number(shortages[c.id]) || 0,
            note: notes[c.id] || null,
          }))
          .filter((s) => s.shortage_qty > 0);
        await instructorReturnLoan(loan.id, {
          returned_on: returnedOn,
          condition_memo: memo || null,
          shortages: sh,
        });
        toast.success("반납 처리되었습니다");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "오류");
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        반납 처리
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>반납 처리</DialogTitle>
            <DialogDescription>
              {loan.equipment?.name ?? "교구"} · {loan.quantity}개. 부족·파손이 있으면 남겨주세요 (사장님이 확인합니다).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ret">반납일</Label>
              <Input
                id="ret"
                type="date"
                value={returnedOn}
                onChange={(e) => setReturnedOn(e.target.value)}
              />
            </div>

            {components.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>구성품 부족·파손 (없으면 비워두세요)</Label>
                <div className="flex flex-col gap-2 max-h-[35vh] overflow-y-auto pr-1">
                  {components.map((c) => (
                    <div key={c.id} className="rounded-md border p-2 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {c.name}
                          {c.unit ? ` (${c.unit})` : ""}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">부족</span>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            className="w-20"
                            value={shortages[c.id] ?? ""}
                            onChange={(e) =>
                              setShortages((p) => ({ ...p, [c.id]: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <Input
                        placeholder="메모 (예: 날 부러짐)"
                        value={notes[c.id] ?? ""}
                        onChange={(e) =>
                          setNotes((p) => ({ ...p, [c.id]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memo">상태 메모</Label>
              <Textarea
                id="memo"
                rows={2}
                placeholder="예: 전반적으로 양호"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              반납 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
