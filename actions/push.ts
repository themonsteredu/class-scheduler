"use server";

import { requireUser } from "@/lib/supabase/server";
import { sendPushToUser, isPushConfigured } from "@/lib/push";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

export async function savePushSubscription(sub: PushSubscriptionInput) {
  if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) {
    throw new Error("잘못된 구독 정보입니다.");
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw new Error(error.message);
}

export async function deletePushSubscription(endpoint: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}

export async function sendTestPush() {
  if (!isPushConfigured()) {
    throw new Error("서버에 VAPID 키가 설정되지 않았습니다.");
  }
  const { supabase, user } = await requireUser();
  await sendPushToUser(supabase, user.id, {
    title: "알림 테스트",
    body: "교구 부족 알림이 정상적으로 도착합니다.",
    url: "/equipment",
    tag: "test",
  });
}
