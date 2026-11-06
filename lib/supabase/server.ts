import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ProfileRow } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "class_scheduler" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from Server Component; ignore
          }
        },
      },
    },
  );
}

// Verify the Auth user at the data-access boundary. React cache only deduplicates
// these checks within the current render; it does not share sessions across users.
const getAuthenticatedContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

export async function requireUser() {
  const { supabase, user } = await getAuthenticatedContext();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Membership is created only when a signed-in user enters this scheduler.
// The guarded RPC always creates a pending member; the owner is seeded separately.
export const getProfile = cache(async () => {
  const { supabase, user } = await getAuthenticatedContext();
  if (!user)
    return { supabase, user: null, profile: null as ProfileRow | null };
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("스케줄러 회원 정보를 불러오지 못했습니다.");

  let profile = (data ?? null) as ProfileRow | null;
  if (!profile) {
    const displayName = user.user_metadata?.display_name;
    const { data: created, error: createError } = await supabase
      .rpc("ensure_profile", {
        p_display_name: typeof displayName === "string" ? displayName : null,
      })
      .single();
    if (createError || !created) {
      throw new Error("스케줄러 가입 요청을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
    profile = created as ProfileRow;
  }

  return { supabase, user, profile };
});

export async function requireAdmin() {
  const { supabase, user, profile } = await getProfile();
  if (!user) redirect("/login");
  if (!profile || profile.role === "pending") redirect("/pending");
  if (profile.role !== "admin") redirect("/me");
  return { supabase, user, profile };
}

export async function requireInstructor() {
  const { supabase, user, profile } = await getProfile();
  if (!user) redirect("/login");
  if (!profile || profile.role === "pending") redirect("/pending");
  if (profile.role !== "instructor") redirect("/");
  if (!profile.instructor_id) redirect("/pending");
  return { supabase, user, profile, instructorId: profile.instructor_id };
}
