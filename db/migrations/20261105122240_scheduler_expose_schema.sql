-- Apply AFTER the isolated schema + verified owner seed, and only after a live
-- PGRST106 probe confirms these original eight exposed schemas are still current.
-- CLI-generated filename: supabase 3.0.0 migration new scheduler_expose_schema.
-- This preserves the existing list/order and appends only class_scheduler.
-- class_scheduler_private MUST NEVER be exposed.
-- Operational note: this database-role override takes precedence over later
-- Dashboard schema-list edits; update both consistently in future maintenance.

do $$
begin
  if not exists (select 1 from class_scheduler_private.application_owner a
    join class_scheduler.profiles p on p.id = a.user_id
    where a.singleton and p.role = 'admin' and p.owner_id = p.id) then
    raise exception 'Seed the verified scheduler owner before exposing its schema.';
  end if;
end;
$$;

alter role authenticator set pgrst.db_schemas =
  'public, graphql_public, lms, edu, ops, moalab, moasem, ai_upcycling, class_scheduler';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
