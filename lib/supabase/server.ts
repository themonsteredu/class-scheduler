import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ProfileRow } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

export async function requireUser() {
  const supabase = await createClient();
  // Session is verified in middleware. Here we just read the cookie (no network call)
  // to avoid duplicate auth latency on every page render.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) redirect("/login");
  return { supabase, user: session.user };
}

// Loads the current user's profile (role, instructor link).
// profile is null before the profiles migration is applied.
export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user)
    return { supabase, user: null, profile: null as ProfileRow | null };
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();
  return {
    supabase,
    user: session.user,
    profile: (data ?? null) as ProfileRow | null,
  };
}

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
