import type { RequestStatus, ExtraFee, ParseResult } from "@/lib/schemas";

export type UUID = string;

export interface InstructorRow {
  id: UUID;
  user_id: UUID;
  name: string;
  phone: string | null;
  email: string | null;
  subjects: string[] | null;
  default_payout: number | null;
  bank_account: string | null;
  memo: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientRow {
  id: UUID;
  user_id: UUID;
  name: string;
  contact_person: string | null;
  phone: string | null;
  default_commission_rate: number | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassRequestRow {
  id: UUID;
  user_id: UUID;
  client_id: UUID | null;
  instructor_id: UUID | null;
  school_name: string | null;
  class_date: string | null;
  start_time: string | null;
  end_time: string | null;
  subject: string | null;
  grade: string | null;
  student_count: number | null;
  fee_total: number | null;
  instructor_payout: number | null;
  my_commission: number | null;
  extra_fees: ExtraFee[] | null;
  status: RequestStatus;
  raw_message: string | null;
  parsed_meta: ParseResult | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
  client?: { id: UUID; name: string } | null;
  instructor?: { id: UUID; name: string } | null;
}

export interface MonthlyIncomeRow {
  user_id: UUID;
  ym: string;
  gross: number;
  paid_to_instructors: number;
  my_commission: number;
  my_extra_income: number;
  extra_costs: number;
  my_net: number;
}
