"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/server";

// 승인: 대기중인 가입자를 강사로 지정하고 강사 명단과 연결.
// 기존 강사(instructorId) 선택 또는 새 강사명(newName)으로 생성.
export async function approveMember(
  profileId: string,
  opts: { instructorId?: string | null; newName?: string | null },
) {
  const { supabase, user } = await requireAdmin();

  let instructorId = opts.instructorId || null;
  if (!instructorId) {
    const name = (opts.newName || "").trim();
    if (!name) throw new Error("연결할 강사를 선택하거나 이름을 입력하세요.");
    const { data, error } = await supabase
      .from("instructors")
      .insert({ user_id: user.id, name, active: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    instructorId = data.id;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: "instructor", instructor_id: instructorId, owner_id: user.id })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// 연결 해제: 다시 승인대기 상태로.
export async function revokeMember(profileId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ role: "pending", instructor_id: null })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}
