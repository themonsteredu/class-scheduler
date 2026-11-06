-- Post-deployment checks. Read-only; no test accounts or business records created.
-- Run as the trusted DB administrator after owner seed. Transaction rolls back.
begin;
set local transaction read only;

select set_config('class_scheduler.verify_owner_id', user_id::text, true)
from class_scheduler_private.application_owner where singleton;

do $$
begin
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'class_scheduler' and c.relkind = 'r' and c.relrowsecurity) <> 11 then
    raise exception 'Expected 11 scheduler tables with RLS.';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'class_scheduler' and c.relkind = 'v'
        and c.reloptions @> array['security_invoker=true']) <> 2 then
    raise exception 'Expected two security_invoker views.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'class_scheduler' and p.prosecdef) then
    raise exception 'Exposed RPC must not be security definer.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('class_scheduler', 'class_scheduler_private')
        and has_function_privilege('anon', p.oid, 'EXECUTE')) then
    raise exception 'Anonymous access to scheduler functions must be denied.';
  end if;
  if has_table_privilege('authenticated', 'class_scheduler.profiles', 'INSERT')
    or has_table_privilege('authenticated', 'class_scheduler.profiles', 'UPDATE')
    or has_table_privilege('authenticated', 'class_scheduler.profiles', 'DELETE') then
    raise exception 'Profiles must be writable only through guarded membership RPCs.';
  end if;
  if (select count(*) from class_scheduler.profiles where role = 'admin'
      and id = current_setting('class_scheduler.verify_owner_id')::uuid and owner_id = id) <> 1 then
    raise exception 'Expected exactly one correctly seeded owner profile.';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('class_scheduler.verify_owner_id'), true);
do $$
begin
  if class_scheduler_private.current_admin_id() is distinct from auth.uid() then
    raise exception 'Seeded owner cannot resolve its admin role.';
  end if;
  if not exists (select 1 from class_scheduler.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Seeded owner cannot read its own profile.';
  end if;
end;
$$;

-- A nonmember JWT claim cannot see any scheduler rows or inherit owner access.
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
do $$
begin
  if class_scheduler_private.current_admin_id() is not null
     or class_scheduler_private.current_owner_id() is not null
     or class_scheduler_private.current_instructor_id() is not null then
    raise exception 'Nonmember unexpectedly inherits scheduler permissions.';
  end if;
  if exists (select 1 from class_scheduler.profiles)
     or exists (select 1 from class_scheduler.class_requests)
     or exists (select 1 from class_scheduler.instructors)
     or exists (select 1 from class_scheduler.equipment)
     or exists (select 1 from class_scheduler.equipment_stock)
     or exists (select 1 from class_scheduler.monthly_income) then
    raise exception 'Nonmember can see scheduler data.';
  end if;
end;
$$;

select 'PASS: schema, grants, owner and nonmember RLS checks' as verification;
rollback;
