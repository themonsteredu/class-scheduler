"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STATUS_VALUES,
  type ParseResult,
  type RequestFormValues,
  type RequestStatus,
} from "@/lib/schemas";
import type { ClientRow, InstructorRow } from "@/types/database";
import { createRequestsBulk } from "@/actions/requests";
import { fmtKRW } from "@/lib/money";

interface Props {
  clients: Pick<ClientRow, "id" | "name">[];
  instructors: Pick<InstructorRow, "id" | "name" | "active">[];
}

interface Row {
  include: boolean;
  client_id: string | null;
  instructor_id: string | null;
  school_name: string;
  class_date: string;
  start_time: string;
  end_time: string;
  subject: string;
  grade: string;
  student_count: string;
  fee_total: string;
  status: RequestStatus;
  memo: string;
  _notes?: string | null;
}

const SELF = "__self__";
const NO_CLIENT = "__none__";

function matchClient(
  name: string | null | undefined,
  clients: Pick<ClientRow, "id" | "name">[],
): string | null {
  if (!name) return null;
  const hit = clients.find(
    (c) =>
      c.name === name ||
      c.name.includes(name) ||
      name.includes(c.name),
  );
  return hit?.id ?? null;
}

function matchInstructor(
  name: string | null | undefined,
  instructors: Pick<InstructorRow, "id" | "name">[],
): string | null {
  if (!name) return null;
  const hit = instructors.find(
    (i) =>
      i.name === name ||
      i.name.includes(name) ||
      name.includes(i.name),
  );
  return hit?.id ?? null;
}

function toRow(
  r: ParseResult,
  clients: Pick<ClientRow, "id" | "name">[],
  instructors: Pick<InstructorRow, "id" | "name">[],
): Row {
  return {
    include: true,
    client_id: matchClient(r.client_name_guess, clients),
    instructor_id: matchInstructor(r.instructor_name_guess, instructors),
    school_name: r.school_name ?? "",
    class_date: r.class_date ?? "",
    start_time: r.start_time ?? "",
    end_time: r.end_time ?? "",
    subject: r.subject ?? "",
    grade: r.grade ?? "",
    student_count: r.student_count != null ? String(r.student_count) : "",
    fee_total: r.fee_guess != null ? String(r.fee_guess) : "",
    status: "의뢰접수",
    memo: "",
    _notes: r.notes ?? null,
  };
}

export function BulkImport({ clients, instructors }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, startSave] = useTransition();

  async function runParse() {
    if (!message.trim()) {
      toast.warning("붙여넣을 원문이 필요합니다");
      return;
    }
    setParsing(true);
    try {
      const res = await fetch("/api/parse-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          existingClients: clients.map((c) => c.name),
          existingInstructors: instructors.map((i) => i.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "AI 파싱 실패");
        return;
      }
      const parsed = data.parsed as ParseResult[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        toast.warning("추출된 수업이 없습니다");
        return;
      }
      setRows(parsed.map((r) => toRow(r, clients, instructors)));
      toast.success(`${parsed.length}건 추출됨 — 확인 후 저장하세요`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      toast.error(msg);
    } finally {
      setParsing(false);
    }
  }

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function onSave() {
    const selected = rows.filter((r) => r.include);
    if (selected.length === 0) {
      toast.warning("저장할 수업을 체크해주세요");
      return;
    }
    startSave(async () => {
      try {
        const payload: RequestFormValues[] = selected.map((r) => ({
          client_id: r.client_id,
          instructor_id: r.instructor_id,
          school_name: r.school_name || null,
          class_date: r.class_date || null,
          start_time: r.start_time || null,
          end_time: r.end_time || null,
          subject: r.subject || null,
          grade: r.grade || null,
          student_count: r.student_count === "" ? null : Number(r.student_count),
          sessions: 1,
          region: null,
          fee_total: r.fee_total === "" ? null : Number(r.fee_total),
          instructor_payout: 0,
          extra_fees: [],
          status: r.status,
          raw_message: null,
          memo: r._notes ? (r.memo ? `${r.memo}\n[AI notes] ${r._notes}` : `[AI notes] ${r._notes}`) : r.memo || null,
        }));
        const result = await createRequestsBulk(payload, message || null);
        toast.success(`${result.inserted}건 저장되었습니다`);
        router.push("/requests");
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        toast.error(msg);
      }
    });
  }

  const selectedCount = rows.filter((r) => r.include).length;
  const totalFee = rows
    .filter((r) => r.include)
    .reduce((a, r) => a + (Number(r.fee_total) || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>원문 붙여넣기</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Label htmlFor="bulk-paste" className="sr-only">
            원문
          </Label>
          <Textarea
            id="bulk-paste"
            rows={8}
            placeholder={`여러 수업 일정을 한 번에 붙여넣으세요. 예:\n4/22(수) 대자중 13:30~15:10 3D펜아티스트 이서은\n4/27(월) 진흥중 13:40~15:20 드론전문가 이서은`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={runParse} disabled={parsing}>
              {parsing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              AI로 추출
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>추출된 수업 {rows.length}건</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="min-w-[130px]">날짜</TableHead>
                    <TableHead className="min-w-[100px]">시작</TableHead>
                    <TableHead className="min-w-[100px]">종료</TableHead>
                    <TableHead className="min-w-[120px]">학교</TableHead>
                    <TableHead className="min-w-[120px]">과목</TableHead>
                    <TableHead className="min-w-[70px]">학년</TableHead>
                    <TableHead className="min-w-[70px]">인원</TableHead>
                    <TableHead className="min-w-[140px]">강사</TableHead>
                    <TableHead className="min-w-[140px]">업체</TableHead>
                    <TableHead className="min-w-[120px] text-right">내 수입</TableHead>
                    <TableHead className="min-w-[110px]">상태</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={idx} className={!r.include ? "opacity-40" : ""}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={(e) => update(idx, { include: e.target.checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={r.class_date}
                          onChange={(e) => update(idx, { class_date: e.target.value })}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={r.start_time}
                          onChange={(e) => update(idx, { start_time: e.target.value })}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={r.end_time}
                          onChange={(e) => update(idx, { end_time: e.target.value })}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.school_name}
                          onChange={(e) => update(idx, { school_name: e.target.value })}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.subject}
                          onChange={(e) => update(idx, { subject: e.target.value })}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.grade}
                          onChange={(e) => update(idx, { grade: e.target.value })}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={r.student_count}
                          onChange={(e) => update(idx, { student_count: e.target.value })}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.instructor_id ?? SELF}
                          onValueChange={(v) =>
                            update(idx, { instructor_id: v === SELF ? null : v })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SELF}>본인 직접</SelectItem>
                            {instructors
                              .filter((i) => i.active || i.id === r.instructor_id)
                              .map((i) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.client_id ?? NO_CLIENT}
                          onValueChange={(v) =>
                            update(idx, { client_id: v === NO_CLIENT ? null : v })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_CLIENT}>(없음)</SelectItem>
                            {clients.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={r.fee_total}
                          onChange={(e) => update(idx, { fee_total: e.target.value })}
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.status}
                          onValueChange={(v) =>
                            update(idx, { status: v as RequestStatus })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_VALUES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {rows.some((r) => r._notes) && (
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">AI 추출 메모</div>
                {rows.map(
                  (r, i) =>
                    r._notes && (
                      <div key={i} className="flex gap-2">
                        <Badge variant="muted" className="shrink-0">
                          #{i + 1}
                        </Badge>
                        <span>{r._notes}</span>
                      </div>
                    ),
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t">
              <div className="text-sm text-muted-foreground">
                선택 {selectedCount}건 · 내 수입 합계{" "}
                <span className="tabular-nums">{fmtKRW(totalFee)}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRows([])}
                  disabled={saving}
                  className="flex-1 sm:flex-none"
                >
                  초기화
                </Button>
                <Button
                  onClick={onSave}
                  disabled={saving || selectedCount === 0}
                  className="flex-1 sm:flex-none"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {selectedCount}건 저장
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
