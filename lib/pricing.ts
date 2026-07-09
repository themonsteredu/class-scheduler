import type { ProgramMaterialFeeRow } from "@/types/database";

// 지역별 1차시 강사료 (업체가 강사에게 직접 지급하는 강사 수입).
// 필요하면 여기 금액만 바꾸면 전체에 반영됩니다.
export const REGION_RATES: Record<string, number> = {
  광주: 40000,
  시외: 50000,
};

export const REGIONS = ["광주", "시외"] as const;
export type Region = (typeof REGIONS)[number];

export const MATERIAL_FEE_LABEL = "재료비";

// 강사료 = 1차시 지역요율 × 차시수
export function sessionFee(
  region: string | null | undefined,
  sessions: number | null | undefined,
): number {
  if (!region) return 0;
  const rate = REGION_RATES[region] ?? 0;
  const n = sessions && sessions > 0 ? sessions : 0;
  return rate * n;
}

// 재료비(내 수입) = 고정 또는 인당 × 인원수
export function materialFee(
  rule: Pick<ProgramMaterialFeeRow, "fee_type" | "amount"> | null | undefined,
  studentCount: number | null | undefined,
): number {
  if (!rule) return 0;
  if (rule.fee_type === "per_person") {
    return (rule.amount ?? 0) * (studentCount && studentCount > 0 ? studentCount : 0);
  }
  return rule.amount ?? 0;
}

export function fmtMaterialRule(
  rule: Pick<ProgramMaterialFeeRow, "fee_type" | "amount">,
): string {
  return rule.fee_type === "per_person"
    ? `인당 ${rule.amount.toLocaleString("ko-KR")}원`
    : `수업당 ${rule.amount.toLocaleString("ko-KR")}원`;
}
