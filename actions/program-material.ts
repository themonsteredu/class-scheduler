"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export async function setProgramMaterialFee(
  programName: string,
  feeType: "fixed" | "per_person",
  amount: number,
) {
  const name = programName.trim();
  if (!name) throw new Error("프로그램(과목) 이름을 입력하세요.");
  const amt = Number.isFinite(amount) && amount >= 0 ? Math.floor(amount) : 0;
  const type = feeType === "per_person" ? "per_person" : "fixed";

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("program_material_fees").upsert(
    {
      user_id: user.id,
      program_name: name,
      fee_type: type,
      amount: amt,
    },
    { onConflict: "user_id,program_name" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/requests");
  revalidatePath("/equipment/schedule");
}

export async function deleteProgramMaterialFee(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("program_material_fees")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/requests");
  revalidatePath("/equipment/schedule");
}
