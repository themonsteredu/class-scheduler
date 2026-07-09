import { Plus, PackagePlus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EquipmentDialog } from "@/components/equipment-dialog";
import { EquipmentRowActions } from "@/components/equipment-row-actions";
import { LoanDialog } from "@/components/loan-dialog";
import { LoanRowActions } from "@/components/loan-row-actions";
import { fmtDate, todayISO } from "@/lib/date";
import type {
  EquipmentRow,
  EquipmentLoanRow,
  InstructorRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const { supabase, user } = await requireUser();

  const [{ data: equipmentData }, { data: loanData }, { data: instructorData }] =
    await Promise.all([
      supabase
        .from("equipment")
        .select("*")
        .eq("user_id", user.id)
        .order("active", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("equipment_loans")
        .select("*, equipment:equipment(id,name), instructor:instructors(id,name)")
        .eq("user_id", user.id)
        .order("checked_out_on", { ascending: false }),
      supabase
        .from("instructors")
        .select("id,name,active")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
    ]);

  const equipment = (equipmentData ?? []) as EquipmentRow[];
  const loans = (loanData ?? []) as unknown as EquipmentLoanRow[];
  const instructors = (instructorData ?? []) as Pick<
    InstructorRow,
    "id" | "name" | "active"
  >[];

  const activeLoans = loans.filter((l) => l.status === "대여중");
  const returnedLoans = loans.filter((l) => l.status === "반납완료");

  // Aggregate: how many of each equipment are currently checked out.
  const checkedOutById = new Map<string, number>();
  for (const l of activeLoans) {
    checkedOutById.set(
      l.equipment_id,
      (checkedOutById.get(l.equipment_id) ?? 0) + l.quantity,
    );
  }

  const stock = equipment.map((e) => {
    const checkedOut = checkedOutById.get(e.id) ?? 0;
    const available = e.total_quantity - checkedOut;
    return {
      equipment: e,
      checkedOut,
      available,
      needsRestock: available <= e.low_stock_threshold,
    };
  });

  const restockList = stock.filter((s) => s.equipment.active && s.needsRestock);
  const equipmentForLoan = stock
    .filter((s) => s.equipment.active)
    .map((s) => ({
      equipment_id: s.equipment.id,
      name: s.equipment.name,
      available: s.available,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">교구</h1>
          <p className="text-sm text-muted-foreground mt-1">
            교구 {equipment.length}종 · 대여중 {activeLoans.length}건
            {restockList.length > 0 && (
              <span className="text-destructive"> · 보충 필요 {restockList.length}종</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <LoanDialog
            equipment={equipmentForLoan}
            instructors={instructors}
            trigger={
              <Button size="sm" variant="outline" disabled={equipmentForLoan.length === 0}>
                <PackagePlus className="h-4 w-4" /> 대여
              </Button>
            }
          />
          <EquipmentDialog
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> 교구 추가
              </Button>
            }
          />
        </div>
      </div>

      {restockList.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">보충이 필요한 교구</CardTitle>
            <CardDescription>
              여유 수량이 보충 기준 이하입니다. 분실·파손으로 줄어든 수량도 반영됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {restockList.map((s) => (
                <Badge key={s.equipment.id} variant="destructive">
                  {s.equipment.name} · 여유 {s.available}/{s.equipment.total_quantity}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">교구 재고</TabsTrigger>
          <TabsTrigger value="out">대여중 ({activeLoans.length})</TabsTrigger>
          <TabsTrigger value="returned">반납 이력</TabsTrigger>
        </TabsList>

        {/* 재고 */}
        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>교구 재고</CardTitle>
              <CardDescription>
                여유 = 총 보유 − 대여중. 보충 기준 이하면 &quot;보충 필요&quot;로 표시됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stock.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  등록된 교구가 없습니다. 우측 상단의 &quot;교구 추가&quot;를 눌러 시작하세요.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>교구</TableHead>
                      <TableHead className="hidden sm:table-cell">분류</TableHead>
                      <TableHead className="text-right">여유</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">대여중</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">총 보유</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stock.map((s) => (
                      <TableRow key={s.equipment.id} className={s.equipment.active ? "" : "opacity-50"}>
                        <TableCell>
                          <div className="font-medium">{s.equipment.name}</div>
                          <div className="text-xs text-muted-foreground sm:hidden">
                            대여중 {s.checkedOut} / 총 {s.equipment.total_quantity}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {s.equipment.category ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {s.available}
                        </TableCell>
                        <TableCell className="text-right tabular-nums hidden sm:table-cell text-muted-foreground">
                          {s.checkedOut}
                        </TableCell>
                        <TableCell className="text-right tabular-nums hidden sm:table-cell text-muted-foreground">
                          {s.equipment.total_quantity}
                        </TableCell>
                        <TableCell>
                          {!s.equipment.active ? (
                            <Badge variant="muted">숨김</Badge>
                          ) : s.needsRestock ? (
                            <Badge variant="destructive">보충 필요</Badge>
                          ) : (
                            <Badge variant="success">충분</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <EquipmentRowActions equipment={s.equipment} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 대여중 */}
        <TabsContent value="out">
          <Card>
            <CardHeader>
              <CardTitle>대여중 — 누가 가지고 있나</CardTitle>
              <CardDescription>아직 반납되지 않은 교구 목록입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {activeLoans.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  현재 대여중인 교구가 없습니다.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>교구</TableHead>
                      <TableHead>가진 사람</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead className="hidden sm:table-cell">대여일</TableHead>
                      <TableHead className="hidden sm:table-cell">반납 예정</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeLoans.map((l) => {
                      const overdue = l.due_on != null && l.due_on < todayISO();
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">
                            {l.equipment?.name ?? "—"}
                          </TableCell>
                          <TableCell>{l.instructor?.name ?? "본인 보관"}</TableCell>
                          <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground tabular-nums">
                            {fmtDate(l.checked_out_on)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell tabular-nums">
                            {l.due_on ? (
                              overdue ? (
                                <span className="text-destructive">{fmtDate(l.due_on)} (지남)</span>
                              ) : (
                                <span className="text-muted-foreground">{fmtDate(l.due_on)}</span>
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <LoanRowActions loan={l} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 반납 이력 */}
        <TabsContent value="returned">
          <Card>
            <CardHeader>
              <CardTitle>반납 이력</CardTitle>
              <CardDescription>
                반납 시 기록한 분실·파손과 상태 메모를 볼 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {returnedLoans.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  반납된 기록이 없습니다.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>교구</TableHead>
                      <TableHead>강사</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead className="hidden sm:table-cell">반납일</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnedLoans.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          {l.equipment?.name ?? "—"}
                          {l.condition_memo && (
                            <div className="text-xs text-muted-foreground">{l.condition_memo}</div>
                          )}
                        </TableCell>
                        <TableCell>{l.instructor?.name ?? "본인 보관"}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground tabular-nums">
                          {fmtDate(l.returned_on)}
                        </TableCell>
                        <TableCell>
                          {l.lost_damaged_qty > 0 ? (
                            <Badge variant="destructive">분실·파손 {l.lost_damaged_qty}</Badge>
                          ) : (
                            <Badge variant="success">정상 반납</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <LoanRowActions loan={l} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
