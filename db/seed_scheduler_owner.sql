-- Run once as a trusted database administrator after the isolated migration.
-- In the same transaction, set BOTH values from independently verified Auth data:
--   select set_config('class_scheduler.bootstrap_owner_id', '<verified UUID>', true);
--   select set_config('class_scheduler.bootstrap_owner_email', '<verified email>', true);
-- This does not create an Auth account or modify its credentials/confirmation.
do $$
declare
  v_owner_id uuid := nullif(current_setting('class_scheduler.bootstrap_owner_id', true), '')::uuid;
  v_expected_email text := nullif(current_setting('class_scheduler.bootstrap_owner_email', true), '');
  v_email text;
begin
  if v_owner_id is null or v_expected_email is null then
    raise exception 'Provide the independently verified owner ID and email in this transaction.';
  end if;
  select u.email into v_email from auth.users u
    where u.id = v_owner_id and lower(u.email) = lower(v_expected_email)
      and u.email_confirmed_at is not null;
  if v_email is null then raise exception 'Verified owner ID/email does not match a confirmed Auth account.'; end if;
  if exists (select 1 from class_scheduler_private.application_owner a where a.user_id <> v_owner_id) then
    raise exception 'This scheduler already has a different owner. Refusing to replace it.';
  end if;
  insert into class_scheduler_private.application_owner(singleton, user_id)
    values (true, v_owner_id) on conflict (singleton) do nothing;
  insert into class_scheduler.profiles(id, role, owner_id, email)
    values (v_owner_id, 'admin', v_owner_id, v_email)
    on conflict (id) do update set role = 'admin', instructor_id = null,
      owner_id = excluded.owner_id, email = excluded.email;
end;
$$;
