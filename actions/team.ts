"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// 사장님이 강사 계정을 직접 생성 (이메일 인증 없이 바로 사용 가능).
export async function createInstructorAccount(input: {
  email: string;
  password: string;
  name: string;
  instructorId?: string | null;
}) {
  const { supabase, user } = await requireAdmin();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email) throw new Error("이메일을 입력하세요.");
  if (!input.password || input.password.length < 6)
    throw new Error("비밀번호는 6자 이상이어야 합니다.");
  if (!name && !input.instructorId) throw new Error("강사 이름을 입력하세요.");

  const admin = createAdminClient();

  // 1) 인증 사용자 생성 (email_confirm: true → 이메일 확인 불필요)
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (cErr) throw new Error(cErr.message);
  const newUserId = created.user.id;

  // 2) 강사 명단 연결 (없으면 새로 생성)
  let instructorId = input.instructorId || null;
  if (!instructorId) {
    const { data, error } = await supabase
      .from("instructors")
      .insert({ user_id: user.id, name, active: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    instructorId = data.id;
  }

  // 3) 프로필을 강사로 설정 (트리거가 만든 pending 행을 덮어씀)
  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id: newUserId,
      role: "instructor",
      instructor_id: instructorId,
      owner_id: user.id,
      email,
      display_name: name,
    },
    { onConflict: "id" },
  );
  if (pErr) throw new Error(pErr.message);

  revalidatePath("/team");
}

// 승인: 대기중인 가입자를 강사로 지정 + (가능하면) 이메일 확인 처리해서 바로 로그인 가능하게.
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

  // 이메일 미확인 계정도 로그인되도록 확인 처리 (서비스 키가 있을 때만)
  if (isAdminConfigured()) {
    try {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(profileId, { email_confirm: true });
    } catch {
      /* best effort */
    }
  }

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

// 계정 완전 삭제 (인증 사용자 삭제 → 프로필 cascade)
export async function deleteMember(profileId: string) {
  const { user } = await requireAdmin();
  if (profileId === user.id) throw new Error("본인 계정은 삭제할 수 없습니다.");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

// 강사 비밀번호 재설정
export async function setMemberPassword(profileId: string, password: string) {
  await requireAdmin();
  if (!password || password.length < 6)
    throw new Error("비밀번호는 6자 이상이어야 합니다.");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(profileId, { password });
  if (error) throw new Error(error.message);
}
