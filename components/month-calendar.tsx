"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addMonth, fmtTimeRange, thisMonthKST } from "@/lib/date";
import { fmtKRW } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import type { ClassRequestRow } from "@/types/database";

interface Props {
  rows: ClassRequestRow[];
}

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function parseYM(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month: m };
}

function daysInMonth(ym: string) {
  const { year, month } = parseYM(ym);
  // first weekday (0=Sun) of the month
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // pad cells with prev/next month so we have full weeks
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push(`${year}-${mm}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function MonthCalendar({ rows }: Props) {
  const [ym, setYm] = useState<string>(thisMonthKST());
  const today = new Date().toISOString().slice(0, 10);

  const byDate = useMemo(() => {
    const map = new Map<string, ClassRequestRow[]>();
    for (const r of rows) {
      if (!r.class_date) continue;
      const key = r.class_date.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    // sort each day by start_time
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    }
    return map;
  }, [rows]);

  const cells = useMemo(() => daysInMonth(ym), [ym]);
  const [selected, setSelected] = useState<string | null>(today);
  const selectedRows = selected ? byDate.get(selected) ?? [] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setYm(addMonth(ym, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-lg font-semibold px-2 tabular-nums">{ym}</div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setYm(addMonth(ym, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setYm(thisMonthKST())}>
          이번 달
        </Button>
      </div>

      <div className="grid grid-cols-7 border rounded-lg overflow-hidden bg-card">
        {WEEK_DAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "px-1 py-2 text-[10px] sm:text-xs font-medium text-center border-b bg-muted/40",
              i === 0 && "text-red-600",
              i === 6 && "text-sky-600",
            )}
          >
            {d}
          </div>
        ))}
        {cells.map((date, idx) => {
          const day = date ? Number(date.slice(-2)) : null;
          const dayOfWeek = idx % 7;
          const classes = date ? byDate.get(date) ?? [] : [];
          const isToday = date === today;
          const isSelected = date === selected;
          return (
            <button
              type="button"
              key={idx}
              onClick={() => date && setSelected(date)}
              disabled={!date}
              className={cn(
                "min-h-[52px] sm:min-h-[90px] border-t border-l first:border-l-0 p-1 sm:p-1.5 text-left flex flex-col gap-0.5 sm:gap-1 transition-colors",
                idx % 7 === 0 && "border-l-0",
                !date && "bg-muted/10 cursor-default",
                date && "hover:bg-accent/40",
                isSelected && "bg-accent/60",
              )}
            >
              {day && (
                <div
                  className={cn(
                    "text-[11px] sm:text-xs tabular-nums self-start",
                    dayOfWeek === 0 && "text-red-600",
                    dayOfWeek === 6 && "text-sky-600",
                    isToday &&
                      "inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground font-semibold",
                  )}
                >
                  {day}
                </div>
              )}
              {/* Mobile: simple dot count */}
              {classes.length > 0 && (
                <div className="flex sm:hidden items-center gap-0.5 justify-center mt-auto">
                  {classes.length === 1 ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  ) : (
                    <span className="text-[10px] leading-none rounded-full bg-sky-500 text-white px-1.5 py-0.5 tabular-nums">
                      {classes.length}
                    </span>
                  )}
                </div>
              )}
              {/* Desktop: labels */}
              <div className="hidden sm:flex flex-col gap-0.5 overflow-hidden">
                {classes.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    className="text-[10px] truncate rounded bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 px-1.5 py-0.5"
                    title={`${c.school_name ?? ""} ${c.subject ?? ""}`}
                  >
                    {c.start_time?.slice(0, 5) ?? ""} {c.school_name ?? c.subject ?? "수업"}
                  </div>
                ))}
                {classes.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1.5">
                    +{classes.length - 3}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:p-4">
          <div className="text-sm font-semibold">
            {selected} · 수업 {selectedRows.length}건
          </div>
          {selectedRows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-3">
              이 날은 수업이 없습니다.
            </div>
          ) : (
            <ul className="divide-y">
              {selectedRows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/requests/${r.id}`}
                    className="flex items-center justify-between gap-3 py-2 hover:bg-accent/40 -mx-2 px-2 rounded-md"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {fmtTimeRange(r.start_time, r.end_time)}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {r.school_name ?? "(학교 미정)"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.subject ?? "과목 미정"} ·{" "}
                        {r.instructor?.name ?? "본인 직접"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={r.status} />
                      {Number(r.fee_total) > 0 && (
                        <div className="text-xs tabular-nums text-muted-foreground">
                          {fmtKRW(r.fee_total)}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
