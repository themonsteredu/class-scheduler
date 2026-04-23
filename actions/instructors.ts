"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { instructorFormSchema, type InstructorFormValues } from "@/lib/schemas";

function normalizeSubjects(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createInstructor(values: InstructorFormValues) {
  const result = instructorFormSchema.safeParse(values);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".") || "값"}: ${i.message}`)
      .join(" / ");
    throw new Error(`입력 오류 — ${msg}`);
  }
  const parsed = result.data;
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("instructors").insert({
    user_id: user.id,
    name: parsed.name,
    phone: parsed.phone ?? null,
    email: parsed.email ?? null,
    subjects: normalizeSubjects(parsed.subjects),
    default_payout: parsed.default_payout ?? null,
    bank_account: parsed.bank_account ?? null,
    memo: parsed.memo ?? null,
    active: parsed.active ?? true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/instructors");
}

export async function updateInstructor(id: string, values: InstructorFormValues) {
  const result = instructorFormSchema.safeParse(values);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".") || "값"}: ${i.message}`)
      .join(" / ");
    throw new Error(`입력 오류 — ${msg}`);
  }
  const parsed = result.data;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("instructors")
    .update({
      name: parsed.name,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      subjects: normalizeSubjects(parsed.subjects),
      default_payout: parsed.default_payout ?? null,
      bank_account: parsed.bank_account ?? null,
      memo: parsed.memo ?? null,
      active: parsed.active ?? true,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/instructors");
}

export async function toggleInstructorActive(id: string, active: boolean) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("instructors")
    .update({ active })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/instructors");
}

export async function deleteInstructor(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("instructors")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/instructors");
}
