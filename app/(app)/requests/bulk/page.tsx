import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { BulkImport } from "@/components/bulk-import";
import { Button } from "@/components/ui/button";
import type { ClientRow, InstructorRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function BulkImportPage() {
  const { supabase, user } = await requireUser();
  const [clientsRes, instructorsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id,name")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("instructors")
      .select("id,name,active")
      .eq("user_id", user.id)
      .order("active", { ascending: false })
      .order("name"),
  ]);

  const clients = (clientsRes.data ?? []) as Pick<ClientRow, "id" | "name">[];
  const instructors = (instructorsRes.data ?? []) as Pick<
    InstructorRow,
    "id" | "name" | "active"
  >[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/requests">
            <ArrowLeft className="h-4 w-4" /> 목록
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            여러 수업 한번에 등록
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            월별 일정표를 통째로 붙여넣으면 AI가 건별로 나눠 추출합니다. 확인 후 선택 저장.
          </p>
        </div>
      </div>

      <BulkImport clients={clients} instructors={instructors} />
    </div>
  );
}
