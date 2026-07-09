import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { RequestForm } from "@/components/request-form";
import { Button } from "@/components/ui/button";
import type {
  ClientRow,
  InstructorRow,
  ProgramMaterialFeeRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const { supabase, user } = await requireUser();
  const [clientsRes, instructorsRes, materialRes] = await Promise.all([
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
    supabase.from("program_material_fees").select("*").eq("user_id", user.id),
  ]);

  const clients = (clientsRes.data ?? []) as Pick<ClientRow, "id" | "name">[];
  const instructors = (instructorsRes.data ?? []) as Pick<
    InstructorRow,
    "id" | "name" | "active"
  >[];
  const materialFees = (materialRes.data ?? []) as ProgramMaterialFeeRow[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/requests">
            <ArrowLeft className="h-4 w-4" /> 목록
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">의뢰 등록</h1>
          <p className="text-sm text-muted-foreground mt-1">
            카카오톡 원문을 붙여넣고 &quot;AI로 자동 채우기&quot;를 눌러 보세요.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/requests/bulk">여러 수업 한번에 →</Link>
        </Button>
      </div>

      <RequestForm
        mode="new"
        clients={clients}
        instructors={instructors}
        materialFees={materialFees}
      />
    </div>
  );
}
