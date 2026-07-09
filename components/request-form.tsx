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
  type ParseResult,
  type RequestFormValues,
  type RequestStatus,
} from "@/lib/schemas";
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
import { createRequest, deleteRequest, updateRequest } from "@/actions/requests";
import { fmtKRW } from "@/lib/money";
import {
  REGIONS,
  sessionFee,
  materialFee,
  fmtMaterialRule,
  MATERIAL_FEE_LABEL,
} from "@/lib/pricing";
import type {
  ClassRequestRow,
  ClientRow,
  InstructorRow,
  ProgramMaterialFeeRow,
} from "@/types/database";

interface Props {
  mode: "new" | "edit";
  request?: ClassRequestRow;
  clients: Pick<ClientRow, "id" | "name">[];
  instructors: Pick<InstructorRow, "id" | "name" | "active">[];
  materialFees: ProgramMaterialFeeRow[];
}

const SELF_INSTRUCTOR = "__self__";
const NO_CLIENT = "__none__";
const NO_REGION = "__none__";

const CONFIDENCE_VARIANTS: Record<string, "success" | "warning" | "muted"> = {
  high: "success",
  mid: "warning",
  low: "muted",
};

export function RequestForm({
  mode,
  request,
  clients,
  instructors,
  materialFees,
}: Props) {
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
      sessions: request?.sessions ?? 1,
      region: request?.region ?? "",
      fee_total: request?.fee_total ?? null,
      instructor_payout: 0,
      extra_fees: [],
      status: request?.status ?? "의뢰접수",
      raw_message: request?.raw_message ?? "",
      memo: request?.memo ?? "",
    },
  });

  const watched = form.watch();

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

  // Derived money: 강사료(업체→강사) = 차시 × 지역요율, 재료비(내 수입) = 규칙 기반.
  function computeMoney(values: RequestFormValues) {
    const region = values.region && values.region !== "" ? values.region : null;
    const payout = sessionFee(region, Number(values.sessions) || 0);
    const rule = materialFees.find(
      (m) => m.program_name === (values.subject ?? "").trim(),
    );
    const mat = materialFee(rule, Number(values.student_count) || 0);
    return { payout, mat };
  }

  function onSubmit(values: RequestFormValues) {
    const { payout, mat } = computeMoney(values);
    const finalValues: RequestFormValues = {
      ...values,
      instructor_payout: payout,
      // 사장님은 강사료를 거치지 않으므로 fee_total = 강사료 (수수료 0, 재료비만 내 수입)
      fee_total: payout,
      extra_fees:
        mat > 0
          ? [{ label: MATERIAL_FEE_LABEL, amount: mat, paid_to: "me" as const }]
          : [],
    };
    startTransition(async () => {
      try {
        if (mode === "new") {
          await createRequest(finalValues, parsedMeta);
          // redirect in server action will throw NEXT_REDIRECT
        } else if (request) {
          await updateRequest(request.id, finalValues);
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
                onValueChange={(v) =>
                  field.onChange(v === SELF_INSTRUCTOR ? null : v)
                }
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

        <Field label="차시">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            {...form.register("sessions")}
          />
        </Field>

        <Field label="지역">
          <Controller
            control={form.control}
            name="region"
            render={({ field }) => (
              <Select
                value={field.value && field.value !== "" ? field.value : NO_REGION}
                onValueChange={(v) => field.onChange(v === NO_REGION ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="지역 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_REGION}>(미지정)</SelectItem>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field label="상태">
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select
                value={field.value ?? "의뢰접수"}
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

      <MoneySummary
        region={watched.region}
        sessions={watched.sessions}
        subject={watched.subject}
        studentCount={watched.student_count}
        materialFees={materialFees}
      />

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

function MoneySummary({
  region,
  sessions,
  subject,
  studentCount,
  materialFees,
}: {
  region?: unknown;
  sessions?: unknown;
  subject?: unknown;
  studentCount?: unknown;
  materialFees: ProgramMaterialFeeRow[];
}) {
  const reg = region && region !== "" ? String(region) : null;
  const subjectStr = String(subject ?? "").trim();
  const payout = sessionFee(reg, Number(sessions) || 0);
  const rule = materialFees.find((m) => m.program_name === subjectStr);
  const mat = materialFee(rule, Number(studentCount) || 0);

  return (
    <div className="rounded-md border bg-muted/30 p-3 flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">강사료 (업체 → 강사)</span>
        <span className="font-medium tabular-nums">
          {payout > 0 ? fmtKRW(payout) : "—"}
          {reg && Number(sessions) > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              {" "}
              ({reg} × {Number(sessions)}차시)
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">재료비 (내 수입)</span>
        <span className="font-medium tabular-nums">
          {mat > 0 ? fmtKRW(mat) : "—"}
          {rule && (
            <span className="text-xs text-muted-foreground font-normal">
              {" "}
              ({fmtMaterialRule(rule)})
            </span>
          )}
        </span>
      </div>
      {subjectStr && !rule && (
        <p className="text-xs text-muted-foreground">
          &quot;{subjectStr}&quot; 재료비 규칙이 없어요. 수업 목록 상단 &quot;재료비 규칙&quot;에서 설정하면 자동 반영됩니다.
        </p>
      )}
    </div>
  );
}

