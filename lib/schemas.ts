import { z } from "zod";

export const STATUS_VALUES = [
  "의뢰접수",
  "강사확정",
  "수업완료",
  "정산완료",
  "취소",
] as const;
export type RequestStatus = (typeof STATUS_VALUES)[number];

export const extraFeeSchema = z.object({
  label: z.string().min(1, "항목명 필요"),
  amount: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number().min(0),
  ),
  paid_to: z.enum(["me", "instructor", "client"]),
});
export type ExtraFee = z.infer<typeof extraFeeSchema>;

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v == null || v === "" ? null : v));

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().nullable(),
);

export const instructorFormSchema = z.object({
  name: z.string().min(1, "이름 필수"),
  phone: optionalString,
  email: optionalString,
  subjects: z.string().optional().transform((v) => v ?? ""),
  default_payout: optionalNumber,
  bank_account: optionalString,
  memo: optionalString,
  active: z.boolean().default(true),
});
export type InstructorFormValues = z.input<typeof instructorFormSchema>;

export const clientFormSchema = z.object({
  name: z.string().min(1, "업체명 필수"),
  contact_person: optionalString,
  phone: optionalString,
  default_commission_rate: optionalNumber,
  memo: optionalString,
});
export type ClientFormValues = z.input<typeof clientFormSchema>;

export const requestFormSchema = z.object({
  client_id: z.string().nullable().optional(),
  instructor_id: z.string().nullable().optional(),
  school_name: optionalString,
  class_date: optionalString,
  start_time: optionalString,
  end_time: optionalString,
  subject: optionalString,
  grade: optionalString,
  student_count: optionalNumber,
  fee_total: optionalNumber,
  instructor_payout: optionalNumber,
  extra_fees: z.array(extraFeeSchema).default([]),
  status: z.enum(STATUS_VALUES).default("의뢰접수"),
  raw_message: optionalString,
  memo: optionalString,
});
export type RequestFormValues = z.input<typeof requestFormSchema>;

// AI parse response schema
export const parseResultSchema = z.object({
  school_name: z.string().nullable().optional(),
  class_date: z.string().nullable().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  student_count: z.number().nullable().optional(),
  client_name_guess: z.string().nullable().optional(),
  instructor_name_guess: z.string().nullable().optional(),
  fee_guess: z.number().nullable().optional(),
  confidence: z.record(z.string(), z.string()).optional(),
  notes: z.string().nullable().optional(),
});
export type ParseResult = z.infer<typeof parseResultSchema>;
