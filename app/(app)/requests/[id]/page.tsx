import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { RequestForm } from "@/components/request-form";
import { Button } from "@/components/ui/button";
import type {
  ClassRequestRow,
  ClientRow,
  InstructorRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const [reqRes, clientsRes, instructorsRes] = await Promise.all([
    supabase
      .from("class_requests")
      .select("*, client:clients(id,name), instructor:instructors(id,name)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("id,name")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("instructors")
      .select("id,name,active,default_payout")
      .eq("user_id", user.id)
      .order("active", { ascending: false })
      .order("name"),
  ]);

  if (!reqRes.data) notFound();
  const request = reqRes.data as unknown as ClassRequestRow;
  const clients = (clientsRes.data ?? []) as Pick<ClientRow, "id" | "name">[];
  const instructors = (instructorsRes.data ?? []) as Pick<
    InstructorRow,
    "id" | "name" | "active" | "default_payout"
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
          <h1 className="text-2xl font-semibold tracking-tight">의뢰 상세</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {request.school_name ?? "학교 미정"} · {request.class_date ?? "날짜 미정"}
          </p>
        </div>
      </div>

      <RequestForm
        mode="edit"
        request={request}
        clients={clients}
        instructors={instructors}
      />
    </div>
  );
}
