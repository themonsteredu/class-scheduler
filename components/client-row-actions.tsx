"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ClientDialog } from "@/components/client-dialog";
import type { ClientRow } from "@/types/database";
import { deleteClient } from "@/actions/clients";

export function ClientRowActions({ client }: { client: ClientRow }) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`"${client.name}" 업체를 정말 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteClient(client.id);
        toast.success("삭제되었습니다");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        toast.error(msg);
      }
    });
  }

  return (
    <div className="flex justify-end">
      <ClientDialog
        client={client}
        trigger={
          <Button size="sm" variant="ghost">
            수정
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" disabled={pending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={onDelete}
          >
            삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
