import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

let configured = false;
function ensureConfigured(): boolean {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  if (!configured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
  }
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Best-effort: never throws. Sends to all of the user's subscriptions and
// removes any that the push service reports as gone (404/410).
export async function sendPushToUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) dead.push(s.id);
      }
    }),
  );

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
  }
}

// Checks whether a single equipment (and its components) is at/below its
// restock threshold, and pushes a notification if so. Best-effort.
export async function notifyRestockForEquipment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  equipmentId: string,
): Promise<void> {
  if (!isPushConfigured()) return;

  const { data: eq } = await supabase
    .from("equipment")
    .select("id, name, total_quantity, low_stock_threshold, active")
    .eq("id", equipmentId)
    .eq("user_id", userId)
    .single();
  if (!eq || !eq.active) return;

  const [{ data: outLoans }, { data: comps }] = await Promise.all([
    supabase
      .from("equipment_loans")
      .select("quantity")
      .eq("equipment_id", equipmentId)
      .eq("user_id", userId)
      .eq("status", "대여중"),
    supabase
      .from("equipment_components")
      .select("name, unit, total_quantity, low_stock_threshold")
      .eq("equipment_id", equipmentId)
      .eq("user_id", userId),
  ]);

  const checkedOut = (outLoans ?? []).reduce((a, l) => a + (l.quantity ?? 0), 0);
  const available = eq.total_quantity - checkedOut;
  const shortComps = (comps ?? []).filter(
    (c) => c.total_quantity <= c.low_stock_threshold,
  );

  const reasons: string[] = [];
  if (available <= eq.low_stock_threshold) {
    reasons.push(`세트 여유 ${available}/${eq.total_quantity}`);
  }
  for (const c of shortComps) {
    reasons.push(`${c.name} ${c.total_quantity}${c.unit ?? ""}`);
  }

  if (reasons.length === 0) return;

  await sendPushToUser(supabase, userId, {
    title: `교구 보충 필요: ${eq.name}`,
    body: reasons.join(" · "),
    url: "/equipment",
    tag: `restock-${equipmentId}`,
  });
}
