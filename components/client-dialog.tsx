"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clientFormSchema, type ClientFormValues } from "@/lib/schemas";
import type { ClientRow } from "@/types/database";
import { createClient, updateClient } from "@/actions/clients";

interface Props {
  trigger: React.ReactNode;
  client?: ClientRow;
}

export function ClientDialog({ trigger, client }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(client);

  const form = useForm<ClientFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(clientFormSchema) as any,
    defaultValues: {
      name: client?.name ?? "",
      contact_person: client?.contact_person ?? "",
      phone: client?.phone ?? "",
      default_commission_rate: client?.default_commission_rate ?? null,
      memo: client?.memo ?? "",
    },
  });

  function onSubmit(values: ClientFormValues) {
    startTransition(async () => {
      try {
        if (isEdit && client) {
          await updateClient(client.id, values);
          toast.success("업체 정보가 수정되었습니다");
        } else {
          await createClient(values);
          toast.success("업체가 추가되었습니다");
          form.reset({
            name: "",
            contact_person: "",
            phone: "",
            default_commission_rate: null,
            memo: "",
          });
        }
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        toast.error(msg);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "업체 수정" : "업체 추가"}</DialogTitle>
          <DialogDescription>
            업체명 외 항목은 선택입니다.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">업체명 *</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact_person">담당자</Label>
              <Input id="contact_person" {...form.register("contact_person")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">연락처</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="default_commission_rate">기본 수수료율 (%)</Label>
            <Input
              id="default_commission_rate"
              type="number"
              step="0.01"
              inputMode="decimal"
              {...form.register("default_commission_rate")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memo">메모</Label>
            <Textarea id="memo" rows={3} {...form.register("memo")} />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
