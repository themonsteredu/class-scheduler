"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export async function addProgramEquipment(
  programName: string,
  equipmentId: string,
  quantity: number,
) {
  const name = programName.trim();
  if (!name) throw new Error("프로그램(과목) 이름을 입력하세요.");
  if (!equipmentId) throw new Error("교구를 선택하세요.");
  const qty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("program_equipment").upsert(
    {
      user_id: user.id,
      program_name: name,
      equipment_id: equipmentId,
      quantity: qty,
    },
    { onConflict: "user_id,program_name,equipment_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/equipment/schedule");
}

export async function deleteProgramEquipment(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("program_equipment")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/equipment/schedule");
}
