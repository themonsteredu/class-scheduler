import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const KST = "Asia/Seoul";

export function todayKST(): Date {
  return toZonedTime(new Date(), KST);
}

export function todayISO(): string {
  return formatInTimeZone(new Date(), KST, "yyyy-MM-dd");
}

export function thisMonthKST(): string {
  return formatInTimeZone(new Date(), KST, "yyyy-MM");
}

export function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return {
    start: formatInTimeZone(start, KST, "yyyy-MM-dd"),
    end: formatInTimeZone(end, KST, "yyyy-MM-dd"),
  };
}

export function fmtDate(value: string | null | undefined, pattern = "yyyy-MM-dd"): string {
  if (!value) return "";
  try {
    return formatInTimeZone(new Date(value), KST, pattern);
  } catch {
    return value;
  }
}

export function fmtDateTime(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined,
): string {
  if (!dateStr) return "";
  const d = fmtDate(dateStr, "yyyy-MM-dd");
  return timeStr ? `${d} ${timeStr.slice(0, 5)}` : d;
}

export function fmtTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const s = start?.slice(0, 5) ?? "";
  const e = end?.slice(0, 5) ?? "";
  if (!s && !e) return "";
  if (!e) return s;
  return `${s}~${e}`;
}

export function addMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return formatInTimeZone(d, KST, "yyyy-MM");
}
