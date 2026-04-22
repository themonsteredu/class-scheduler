"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  requestFormSchema,
  STATUS_VALUES,
  type ExtraFee,
  type ParseResult,
  type RequestFormValues,
  type RequestStatus,
} from "@/lib/schemas";
import { computeMyNet, fmtKRW } from "@/lib/money";
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
import { KakaoPasteParser } from "@/components/kakao-paste-parser";
import { ExtraFeesEditor } from "@/components/extra-fees-editor";
import { createRequest, deleteRequest, updateRequest } from "@/actions/requests";
import type { ClassRequestRow, ClientRow, InstructorRow } from "@/types/database";

interface Props {
  mode: "new" | "edit";
  request?: ClassRequestRow;
  clients: Pick<ClientRow, "id" | "name">[];
  instructors: Pick<InstructorRow, "id" | "name" | "active" | "default_payout">[];
}

const SELF_INSTRUCTOR = "__self__";
const NO_CLIENT = "__none__";

const CONFIDENCE_VARIANTS: Record<string, "success" | "warning" | "muted"> = {
  high: "success",
  mid: "warning",
  low: "muted",
};

export function RequestForm({ mode, request, clients, instructors }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confidence, setConfidence] = useState<Record<string, string>>({});
  const [parsedMeta, setParsedMeta] = useState<ParseResult | null>(
    request?.raw_message
      ? ((request as unknown as { parsed_meta?: ParseResult })?.parsed_meta ?? null)
      : null,
  );

  const form = useForm<RequestFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(requestFormSchema) as any,
    defaultValues: {
      client_id: request?.client_id ?? null,
      instructor_id: request?.instructor_id ?? null,
      school_name: request?.school_name ?? "",
      class_date: request?.class_date ?? "",
      start_time: (request?.start_time ?? "").slice(0, 5),
      end_time: (request?.end_time ?? "").slice(0, 5),
      subject: request?.subject ?? "",
      grade: request?.grade ?? "",
      student_count: request?.student_count ?? null,
      fee_total: request?.fee_total ?? null,
      instructor_payout: request?.instructor_payout ?? null,
      extra_fees: (request?.extra_fees ?? []) as ExtraFee[],
      status: request?.status ?? "의뢰접수",
      raw_message: request?.raw_message ?? "",
      memo: request?.memo ?? "",
    },
  });

  const watched = form.watch();
  const myNet = computeMyNet({
    fee_total: toNumber(watched.fee_total),
    instructor_payout: toNumber(watched.instructor_payout),
    extra_fees: (watched.extra_fees ?? []) as ExtraFee[],
  });

  function applyParsed(result: ParseResult, raw: string) {
    setParsedMeta(result);
    setConfidence(result.confidence ?? {});
    if (result.school_name) form.setValue("school_name", result.school_name);
    if (result.class_date) form.setValue("class_date", result.class_date);
    if (result.start_time) form.setValue("start_time", result.start_time);
    if (result.end_time) form.setValue("end_time", result.end_time);
    if (result.subject) form.setValue("subject", result.subject);
    if (result.grade) form.setValue("grade", result.grade);
    if (result.student_count != null)
      form.setValue("student_count", result.student_count);
    if (result.fee_guess != null)
      form.setValue("fee_total", result.fee_guess);
    if (result.client_name_guess) {
      const match = clients.find(
        (c) =>
          c.name === result.client_name_guess ||
          c.name.includes(result.client_name_guess!) ||
          result.client_name_guess!.includes(c.name),
      );
      if (match) form.setValue("client_id", match.id);
    }
    if (result.instructor_name_guess) {
      const match = instructors.find(
        (i) =>
          i.name === result.instructor_name_guess ||
          i.name.includes(result.instructor_name_guess!) ||
          result.instructor_name_guess!.includes(i.name),
      );
      if (match) form.setValue("instructor_id", match.id);
    }
    form.setValue("raw_message", raw);
  }

  function ConfidenceBadge({ field }: { field: string }) {
    const level = confidence[field];
    if (!level) return null;
    const variant = CONFIDENCE_VARIANTS[level] ?? "muted";
    return (
      <Badge variant={variant} className="ml-1 text-[10px]">
        AI {level}
      </Badge>
    );
  }

  function onSubmit(values: RequestFormValues) {
    startTransition(async () => {
      try {
        if (mode === "new") {
          await createRequest(values, parsedMeta);
          // redirect in server action will throw NEXT_REDIRECT
        } else if (request) {
          await updateRequest(request.id, values);
          toast.success("저장되었습니다");
          router.refresh();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        if (msg.includes("NEXT_REDIRECT")) return;
        toast.error(msg);
      }
    });
  }

  function onDelete() {
    if (!request) return;
    if (!confirm("이 의뢰를 삭제할까요? 되돌릴 수 없습니다.")) return;
    startTransition(async () => {
      try {
        await deleteRequest(request.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        if (msg.includes("NEXT_REDIRECT")) return;
        toast.error(msg);
      }
    });
  }

  const activeInstructors = instructors.filter(
    (i) => i.active || i.id === watched.instructor_id,
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {mode === "new" && (
        <KakaoPasteParser
          existingClients={clients.map((c) => c.name)}
          existingInstructors={instructors.map((i) => i.name)}
          onResult={applyParsed}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={<>업체 <ConfidenceBadge field="client_name_guess" /></>}>
          <Controller
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <Select
                value={field.value ?? NO_CLIENT}
                onValueChange={(v) => field.onChange(v === NO_CLIENT ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="업체 선택" />
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
            )}
          />
        </Field>

        <Field label={<>강사 <ConfidenceBadge field="instructor_name_guess" /></>}>
          <Controller
            control={form.control}
            name="instructor_id"
            render={({ field }) => (
              <Select
                value={field.value ?? SELF_INSTRUCTOR}
                onValueChange={(v) => {
                  if (v === SELF_INSTRUCTOR) {
                    field.onChange(null);
                  } else {
                    field.onChange(v);
                    const instructor = instructors.find((i) => i.id === v);
                    if (
                      instructor?.default_payout &&
                      !form.getValues("instructor_payout")
                    ) {
                      form.setValue("instructor_payout", instructor.default_payout);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="강사 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELF_INSTRUCTOR}>본인이 직접 수업</SelectItem>
                  {activeInstructors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                      {!i.active && " (비활성)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field label={<>학교명 <ConfidenceBadge field="school_name" /></>}>
          <Input {...form.register("school_name")} placeholder="예: 양정중" />
        </Field>

        <Field label={<>과목 <ConfidenceBadge field="subject" /></>}>
          <Input {...form.register("subject")} placeholder="예: 진로탐색" />
        </Field>

        <Field label={<>수업 날짜 <ConfidenceBadge field="class_date" /></>}>
          <Input type="date" {...form.register("class_date")} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={<>시작 <ConfidenceBadge field="start_time" /></>}>
            <Input type="time" {...form.register("start_time")} />
          </Field>
          <Field label={<>종료 <ConfidenceBadge field="end_time" /></>}>
            <Input type="time" {...form.register("end_time")} />
          </Field>
        </div>

        <Field label={<>학년 <ConfidenceBadge field="grade" /></>}>
          <Input {...form.register("grade")} placeholder="예: 중1" />
        </Field>

        <Field label={<>인원수 <ConfidenceBadge field="student_count" /></>}>
          <Input
            type="number"
            inputMode="numeric"
            {...form.register("student_count")}
          />
        </Field>

        <Field label={<>총 의뢰금액 (원) <ConfidenceBadge field="fee_guess" /></>}>
          <Input
            type="number"
            inputMode="numeric"
            {...form.register("fee_total")}
          />
        </Field>

        <Field label="강사 지급액 (원)">
          <Input
            type="number"
            inputMode="numeric"
            {...form.register("instructor_payout")}
          />
        </Field>

        <Field label="상태">
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => field.onChange(v as RequestStatus)}
              >
                <SelectTrigger>
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
            )}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <Label>부가 항목 (교통비·자료비 등)</Label>
        <Controller
          control={form.control}
          name="extra_fees"
          render={({ field }) => (
            <ExtraFeesEditor
              value={(field.value ?? []) as ExtraFee[]}
              onChange={(v) => field.onChange(v)}
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="memo">메모</Label>
        <Textarea id="memo" rows={3} {...form.register("memo")} />
      </div>

      {(watched.raw_message || mode === "edit") && (
        <details className="text-sm" open={mode === "new"}>
          <summary className="cursor-pointer text-muted-foreground">
            원문 메시지
          </summary>
          <Textarea
            className="mt-2"
            rows={4}
            {...form.register("raw_message")}
          />
        </details>
      )}

      <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">본인 순수입 (예상)</div>
        <div className="text-xl font-semibold tabular-nums">{fmtKRW(myNet)}</div>
      </div>

      <div className="flex justify-between">
        {mode === "edit" && request ? (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={pending}
          >
            <Trash2 className="h-4 w-4" /> 삭제
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            저장
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center">{label}</Label>
      {children}
    </div>
  );
}

function toNumber(v: unknown): number {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
