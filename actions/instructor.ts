"use server";

import { revalidatePath } from "next/cache";
import { requireInstructor } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";

export interface InstructorShortageInput {
  component_id: string;
  component_name?: string | null;
  shortage_qty: number;
  note?: string | null;
}

// 강사가 본인 대여 교구를 반납 처리. 부족·파손은 기록만 하고(사장님이 확인),
// 재고(교구/구성품 수량)는 강사가 건드리지 않습니다.
export async function instructorReturnLoan(
  loanId: string,
  values: {
    returned_on?: string | null;
    condition_memo?: string | null;
    shortages?: InstructorShortageInput[];
  },
) {
  const { supabase, user, profile } = await requireInstructor();
  const ownerId = profile.owner_id;

  // 반납 처리 (RLS: 본인 대여건만 update 가능)
  const { error } = await supabase
    .from("equipment_loans")
    .update({
      status: "반납완료",
      returned_on: values.returned_on || todayISO(),
      condition_memo: values.condition_memo ?? null,
    })
    .eq("id", loanId)
    .eq("instructor_id", profile.instructor_id);
  if (error) throw new Error(error.message);

  const shortages = (values.shortages ?? []).filter((s) => s.shortage_qty > 0);
  if (shortages.length > 0 && ownerId) {
    const { error: shErr } = await supabase.from("equipment_loan_shortages").insert(
      shortages.map((s) => ({
        user_id: ownerId,
        loan_id: loanId,
        component_id: s.component_id,
        component_name: s.component_name ?? null,
        shortage_qty: s.shortage_qty,
        note: s.note ?? null,
      })),
    );
    if (shErr) throw new Error(shErr.message);
  }

  revalidatePath("/me/equipment");
  void user;
}
