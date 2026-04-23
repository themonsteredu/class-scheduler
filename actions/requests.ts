"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import {
  requestFormSchema,
  type RequestFormValues,
  type ParseResult,
} from "@/lib/schemas";

function normalize(values: RequestFormValues, userId: string) {
  const result = requestFormSchema.safeParse(values);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".") || "값"}: ${i.message}`)
      .join(" / ");
    throw new Error(`입력 오류 — ${msg}`);
  }
  const parsed = result.data;
  return {
    user_id: userId,
    client_id: parsed.client_id || null,
    instructor_id: parsed.instructor_id || null,
    school_name: parsed.school_name ?? null,
    class_date: parsed.class_date ? parsed.class_date : null,
    start_time: parsed.start_time ? parsed.start_time : null,
    end_time: parsed.end_time ? parsed.end_time : null,
    subject: parsed.subject ?? null,
    grade: parsed.grade ?? null,
    student_count: parsed.student_count ?? null,
    fee_total: parsed.fee_total ?? 0,
    instructor_payout: parsed.instructor_payout ?? 0,
    extra_fees: parsed.extra_fees ?? [],
    status: parsed.status ?? "의뢰접수",
    raw_message: parsed.raw_message ?? null,
    memo: parsed.memo ?? null,
  };
}

export async function createRequest(
  values: RequestFormValues,
  parsedMeta?: ParseResult | null,
) {
  const { supabase, user } = await requireUser();
  const row = normalize(values, user.id);
  const { data, error } = await supabase
    .from("class_requests")
    .insert({ ...row, parsed_meta: parsedMeta ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/requests");
  revalidatePath("/");
  redirect(`/requests/${data.id}`);
}

export async function updateRequest(id: string, values: RequestFormValues) {
  const { supabase, user } = await requireUser();
  const row = normalize(values, user.id);
  const { error } = await supabase
    .from("class_requests")
    .update(row)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  revalidatePath("/");
  revalidatePath("/income");
}

export async function deleteRequest(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("class_requests")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/requests");
  revalidatePath("/");
  redirect("/requests");
}
