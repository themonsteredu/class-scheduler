"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/server";

// Connect a confirmed MOAKIT account to this scheduler. Auth credentials and
// memberships in other applications are never changed here.
export async function createInstructorAccount(input: {
  email: string;
  name: string;
  instructorId?: string | null;
}) {
  const { supabase } = await requireAdmin();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email) throw new Error("이메일을 입력하세요.");
  if (!name && !input.instructorId) throw new Error("강사 이름을 입력하세요.");

  const { error } = await supabase.rpc("enroll_member_by_email", {
    p_email: email,
    p_name: name,
    p_instructor_id: input.instructorId || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/team");
  revalidatePath("/instructors");
}

export async function approveMember(
  profileId: string,
  opts: { instructorId?: string | null; newName?: string | null },
) {
  const { supabase } = await requireAdmin();
  const instructorId = opts.instructorId || null;
  const name = (opts.newName || "").trim();
  if (!instructorId && !name) {
    throw new Error("연결할 강사를 선택하거나 이름을 입력하세요.");
  }

  const { error } = await supabase.rpc("approve_member", {
    p_profile_id: profileId,
    p_instructor_id: instructorId,
    p_new_name: name || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/team");
  revalidatePath("/instructors");
}

export async function revokeMember(profileId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("revoke_member", {
    p_profile_id: profileId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// Remove scheduler membership only. The shared Auth account remains usable.
export async function deleteMember(profileId: string) {
  const { supabase, user } = await requireAdmin();
  if (profileId === user.id) throw new Error("본인 계정은 삭제할 수 없습니다.");
  const { error } = await supabase.rpc("remove_member", {
    p_profile_id: profileId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}
