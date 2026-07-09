import { requireInstructor } from "@/lib/supabase/server";
import { InstructorShell } from "@/components/instructor-shell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, user } = await requireInstructor();
  const name = profile.display_name || user.email || "강사";
  return <InstructorShell name={name}>{children}</InstructorShell>;
}
