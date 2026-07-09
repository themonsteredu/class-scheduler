"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import {
  equipmentFormSchema,
  loanFormSchema,
  loanReturnSchema,
  componentFormSchema,
  type EquipmentFormValues,
  type LoanFormValues,
  type LoanReturnValues,
  type ComponentFormValues,
} from "@/lib/schemas";

function issuesToMessage(issues: { path: PropertyKey[]; message: string }[]) {
  return issues
    .map((i) => `${i.path.map(String).join(".") || "값"}: ${i.message}`)
    .join(" / ");
}

// ---------- Equipment (교구 대장) ----------

export async function createEquipment(values: EquipmentFormValues) {
  const result = equipmentFormSchema.safeParse(values);
  if (!result.success) throw new Error(`입력 오류 — ${issuesToMessage(result.error.issues)}`);
  const parsed = result.data;
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("equipment").insert({
    user_id: user.id,
    name: parsed.name,
    category: parsed.category ?? null,
    total_quantity: parsed.total_quantity,
    low_stock_threshold: parsed.low_stock_threshold,
    memo: parsed.memo ?? null,
    active: parsed.active ?? true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/equipment");
}

export async function updateEquipment(id: string, values: EquipmentFormValues) {
  const result = equipmentFormSchema.safeParse(values);
  if (!result.success) throw new Error(`입력 오류 — ${issuesToMessage(result.error.issues)}`);
  const parsed = result.data;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("equipment")
    .update({
      name: parsed.name,
      category: parsed.category ?? null,
      total_quantity: parsed.total_quantity,
      low_stock_threshold: parsed.low_stock_threshold,
      memo: parsed.memo ?? null,
      active: parsed.active ?? true,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/equipment");
}

export async function deleteEquipment(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("equipment")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/equipment");
}

// ---------- Loans (대여 / 반납) ----------

export async function createLoan(values: LoanFormValues) {
  const result = loanFormSchema.safeParse(values);
  if (!result.success) throw new Error(`입력 오류 — ${issuesToMessage(result.error.issues)}`);
  const parsed = result.data;
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("equipment_loans").insert({
    user_id: user.id,
    equipment_id: parsed.equipment_id,
    instructor_id: parsed.instructor_id || null,
    quantity: parsed.quantity,
    checked_out_on: parsed.checked_out_on || todayISO(),
    due_on: parsed.due_on || null,
    memo: parsed.memo ?? null,
    status: "대여중",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/equipment");
}

export async function returnLoan(id: string, values: LoanReturnValues) {
  const result = loanReturnSchema.safeParse(values);
  if (!result.success) throw new Error(`입력 오류 — ${issuesToMessage(result.error.issues)}`);
  const parsed = result.data;
  const { supabase, user } = await requireUser();

  // Load the loan so we know how much to shrink the inventory on loss/damage.
  const { data: loan, error: loanErr } = await supabase
    .from("equipment_loans")
    .select("id, equipment_id, quantity, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (loanErr) throw new Error(loanErr.message);
  if (!loan) throw new Error("대여 기록을 찾을 수 없습니다.");
  if (loan.status === "반납완료") throw new Error("이미 반납된 기록입니다.");

  const shortages = (parsed.shortages ?? []).filter((s) => s.shortage_qty > 0);
  const hasComponentShortages = shortages.length > 0;

  // For component kits the shortage is tracked per component; the equipment-level
  // lost_damaged_qty is only used for simple (component-less) items.
  const lost = hasComponentShortages
    ? 0
    : Math.min(parsed.lost_damaged_qty, loan.quantity);

  const { error } = await supabase
    .from("equipment_loans")
    .update({
      status: "반납완료",
      returned_on: parsed.returned_on || todayISO(),
      lost_damaged_qty: lost,
      condition_memo: parsed.condition_memo ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  // Simple item: lost/damaged units are no longer usable → shrink on-hand total
  // so the "보충 필요" alert can trigger.
  if (lost > 0) {
    const { data: eq } = await supabase
      .from("equipment")
      .select("total_quantity")
      .eq("id", loan.equipment_id)
      .eq("user_id", user.id)
      .single();
    if (eq) {
      const next = Math.max(0, (eq.total_quantity ?? 0) - lost);
      await supabase
        .from("equipment")
        .update({ total_quantity: next })
        .eq("id", loan.equipment_id)
        .eq("user_id", user.id);
    }
  }

  // Component kit: record each component shortage and shrink that component's
  // on-hand total so its own "보충 필요" flag can trigger.
  if (hasComponentShortages) {
    const { error: shErr } = await supabase.from("equipment_loan_shortages").insert(
      shortages.map((s) => ({
        user_id: user.id,
        loan_id: id,
        component_id: s.component_id,
        component_name: s.component_name ?? null,
        shortage_qty: s.shortage_qty,
        note: s.note ?? null,
      })),
    );
    if (shErr) throw new Error(shErr.message);

    for (const s of shortages) {
      const { data: comp } = await supabase
        .from("equipment_components")
        .select("total_quantity")
        .eq("id", s.component_id)
        .eq("user_id", user.id)
        .single();
      if (comp) {
        const next = Math.max(0, (comp.total_quantity ?? 0) - s.shortage_qty);
        await supabase
          .from("equipment_components")
          .update({ total_quantity: next })
          .eq("id", s.component_id)
          .eq("user_id", user.id);
      }
    }
  }

  revalidatePath("/equipment");
  revalidatePath("/");
}

export async function deleteLoan(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("equipment_loans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/equipment");
  revalidatePath("/");
}

// ---------- Components (구성품) ----------

export async function createComponent(
  equipmentId: string,
  values: ComponentFormValues,
) {
  const result = componentFormSchema.safeParse(values);
  if (!result.success) throw new Error(`입력 오류 — ${issuesToMessage(result.error.issues)}`);
  const parsed = result.data;
  const { supabase, user } = await requireUser();

  // New component goes to the end.
  const { count } = await supabase
    .from("equipment_components")
    .select("id", { count: "exact", head: true })
    .eq("equipment_id", equipmentId)
    .eq("user_id", user.id);

  const { error } = await supabase.from("equipment_components").insert({
    user_id: user.id,
    equipment_id: equipmentId,
    name: parsed.name,
    unit: parsed.unit ?? null,
    total_quantity: parsed.total_quantity,
    low_stock_threshold: parsed.low_stock_threshold,
    sort_order: count ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/equipment");
  revalidatePath("/");
}

export async function updateComponent(id: string, values: ComponentFormValues) {
  const result = componentFormSchema.safeParse(values);
  if (!result.success) throw new Error(`입력 오류 — ${issuesToMessage(result.error.issues)}`);
  const parsed = result.data;
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("equipment_components")
    .update({
      name: parsed.name,
      unit: parsed.unit ?? null,
      total_quantity: parsed.total_quantity,
      low_stock_threshold: parsed.low_stock_threshold,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/equipment");
  revalidatePath("/");
}

export async function deleteComponent(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("equipment_components")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/equipment");
  revalidatePath("/");
}
