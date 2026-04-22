import { Badge } from "@/components/ui/badge";
import type { RequestStatus } from "@/lib/schemas";

const MAP: Record<RequestStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "muted" }> = {
  "의뢰접수": { label: "의뢰접수", variant: "info" },
  "강사확정": { label: "강사확정", variant: "warning" },
  "수업완료": { label: "수업완료", variant: "success" },
  "정산완료": { label: "정산완료", variant: "default" },
  "취소": { label: "취소", variant: "muted" },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const m = MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
