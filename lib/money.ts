import type { ExtraFee } from "./schemas";

export function fmtKRW(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₩0";
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

export function sumExtras(
  extras: ExtraFee[] | null | undefined,
  paidTo: ExtraFee["paid_to"],
): number {
  if (!Array.isArray(extras)) return 0;
  return extras
    .filter((e) => e?.paid_to === paidTo)
    .reduce((acc, e) => acc + (Number(e?.amount) || 0), 0);
}

export function computeMyNet({
  fee_total,
  instructor_payout,
  extra_fees,
}: {
  fee_total: number | null | undefined;
  instructor_payout: number | null | undefined;
  extra_fees: ExtraFee[] | null | undefined;
}): number {
  const base = (Number(fee_total) || 0) - (Number(instructor_payout) || 0);
  const mine = sumExtras(extra_fees, "me");
  return base + mine;
}
