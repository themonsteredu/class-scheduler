"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { clientFormSchema, type ClientFormValues } from "@/lib/schemas";

function validate(values: ClientFormValues) {
  const result = clientFormSchema.safeParse(values);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".") || "값"}: ${i.message}`)
      .join(" / ");
    throw new Error(`입력 오류 — ${msg}`);
  }
  return result.data;
}

export async function createClient(values: ClientFormValues) {
  const parsed = validate(values);
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("clients").insert({
    user_id: user.id,
    name: parsed.name,
    contact_person: parsed.contact_person ?? null,
    phone: parsed.phone ?? null,
    default_commission_rate: parsed.default_commission_rate ?? null,
    memo: parsed.memo ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/clients");
}

export async function updateClient(id: string, values: ClientFormValues) {
  const parsed = validate(values);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("clients")
    .update({
      name: parsed.name,
      contact_person: parsed.contact_person ?? null,
      phone: parsed.phone ?? null,
      default_commission_rate: parsed.default_commission_rate ?? null,
      memo: parsed.memo ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/clients");
}

export async function deleteClient(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/clients");
}
