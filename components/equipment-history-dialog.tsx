"use client";

import { useState } from "react";
import { ArrowRight, Circle, Dot } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { fmtDate, todayISO } from "@/lib/date";
import type { EquipmentLoanRow } from "@/types/database";

interface Props {
  trigger: React.ReactNode;
  equipment: { id: string; name: string };
  loans: EquipmentLoanRow[];
}

export function EquipmentHistoryDialog({ trigger, equipment, loans }: Props) {
  const [open, setOpen] = useState(false);

  // 대여중(현재 보유)이 위로, 그 다음 대여일 최신순.
  const sorted = [...loans].sort((a, b) => {
    if (a.status !== b.status) return a.status === "대여중" ? -1 : 1;
    return (b.checked_out_on ?? "").localeCompare(a.checked_out_on ?? "");
  });

  const holders = sorted.filter((l) => l.status === "대여중");
  const today = todayISO();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{equipment.name} · 이동 내역</DialogTitle>
          <DialogDescription>
            {holders.length > 0 ? (
              <span>
                현재 보유:{" "}
                <span className="font-medium text-foreground">
                  {holders
                    .map((h) => `${h.instructor?.name ?? "본인 보관"}(${h.quantity})`)
                    .join(", ")}
                </span>
              </span>
            ) : (
              "현재 대여중인 곳이 없습니다. (모두 반납됨)"
            )}
          </DialogDescription>
        </DialogHeader>

        {sorted.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            아직 대여 기록이 없습니다.
          </div>
        ) : (
          <ol className="flex flex-col gap-0 max-h-[55vh] overflow-y-auto pr-1">
            {sorted.map((l, i) => {
              const holding = l.status === "대여중";
              const overdue = holding && l.due_on != null && l.due_on < today;
              return (
                <li key={l.id} className="flex gap-3">
                  {/* timeline rail */}
                  <div className="flex flex-col items-center">
                    {holding ? (
                      <Circle className="h-3.5 w-3.5 mt-1.5 text-destructive fill-destructive" />
                    ) : (
                      <Dot className="h-3.5 w-3.5 mt-1.5 text-muted-foreground" />
                    )}
                    {i < sorted.length - 1 && (
                      <div className="w-px flex-1 bg-border my-1" />
                    )}
                  </div>

                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {l.instructor?.name ?? "본인 보관"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {l.quantity}개
                      </span>
                      {holding ? (
                        overdue ? (
                          <Badge variant="destructive">보유중 · 기한 지남</Badge>
                        ) : (
                          <Badge variant="secondary">보유중</Badge>
                        )
                      ) : (
                        <Badge variant="muted">반납완료</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                      <span className="tabular-nums">{fmtDate(l.checked_out_on)}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="tabular-nums">
                        {l.returned_on ? fmtDate(l.returned_on) : "보유중"}
                      </span>
                      {holding && l.due_on && (
                        <span className={overdue ? "text-destructive" : ""}>
                          · 반납예정 {fmtDate(l.due_on)}
                        </span>
                      )}
                    </div>
                    {l.condition_memo && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        메모: {l.condition_memo}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
