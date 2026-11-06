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
  const { supabase } = await requireInstructor();
  const shortages = (values.shortages ?? []).filter((s) => s.shortage_qty > 0);
  // The RPC verifies assignment and writes the return + shortages atomically.
  const { error } = await supabase.rpc("return_my_loan", {
    p_loan_id: loanId,
    p_returned_on: values.returned_on || todayISO(),
    p_condition_memo: values.condition_memo ?? null,
    p_shortages: shortages.map((s) => ({
      component_id: s.component_id,
      shortage_qty: s.shortage_qty,
      note: s.note ?? null,
    })),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/me/equipment");
  revalidatePath("/equipment");
}
