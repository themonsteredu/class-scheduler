"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  savePushSubscription,
  deletePushSubscription,
} from "@/actions/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return buffer;
}

function extractKeys(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}

export function EquipmentPushToggle() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      Boolean(VAPID_PUBLIC_KEY);
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
  }, []);

  async function enable() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("알림 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC_KEY!),
      });
      const keys = extractKeys(sub);
      startTransition(async () => {
        try {
          await savePushSubscription({ ...keys, userAgent: navigator.userAgent });
          setSubscribed(true);
          toast.success("교구 부족 알림이 켜졌습니다");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "오류");
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알림을 켤 수 없습니다";
      toast.error(msg);
    }
  }

  async function disable() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        startTransition(async () => {
          try {
            await deletePushSubscription(endpoint);
          } catch {
            /* best effort */
          }
          setSubscribed(false);
          toast.success("알림이 꺼졌습니다");
        });
      } else {
        setSubscribed(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  if (supported === null) return null;
  if (!supported) {
    return (
      <Button size="sm" variant="ghost" disabled title="이 기기/브라우저에서는 알림을 지원하지 않습니다">
        <BellOff className="h-4 w-4" /> 알림 미지원
      </Button>
    );
  }

  return subscribed ? (
    <Button size="sm" variant="ghost" onClick={disable} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
      알림 켜짐
    </Button>
  ) : (
    <Button size="sm" variant="outline" onClick={enable} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
      알림 켜기
    </Button>
  );
}
