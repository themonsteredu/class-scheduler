-- Fresh class-scheduler install in the EXISTING monster-moakit project.
-- CLI-generated filename: supabase 3.0.0 migration new scheduler_isolated_schema.
-- Apply this file by itself; legacy schema.sql / 0001-0006 target public and
-- MUST NOT be applied to this shared project. No Auth trigger/settings changes.
-- Fail closed if either namespace exists; this is an additive, single-use migration.

create schema class_scheduler;
create schema class_scheduler_private;
revoke all on schema class_scheduler from public, anon, authenticated, service_role;
revoke all on schema class_scheduler_private from public, anon, authenticated, service_role;

create type class_scheduler.class_request_status as enum
  ('의뢰접수','강사확정','수업완료','정산완료','취소');
create type class_scheduler.equipment_loan_status as enum ('대여중','반납완료');

create table class_scheduler.instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  subjects text[] default '{}',
  default_payout numeric(12,0),
  bank_account text,
  memo text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table class_scheduler.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_person text,
  phone text,
  default_commission_rate numeric(5,2),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table class_scheduler.class_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references class_scheduler.clients(id) on delete set null,
  instructor_id uuid references class_scheduler.instructors(id) on delete set null,
  school_name text,
  class_date date,
  start_time time,
  end_time time,
  subject text,
  grade text,
  student_count int,
  sessions int not null default 1,
  region text,
  fee_total numeric(12,0) default 0,
  instructor_payout numeric(12,0) default 0,
  my_commission numeric(12,0) generated always as (coalesce(fee_total,0) - coalesce(instructor_payout,0)) stored,
  extra_fees jsonb default '[]'::jsonb,
  status class_scheduler.class_request_status not null default '의뢰접수',
  raw_message text,
  parsed_meta jsonb,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table class_scheduler.equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  total_quantity int not null default 1,
  low_stock_threshold int not null default 0,
  memo text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table class_scheduler.equipment_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid not null references class_scheduler.equipment(id) on delete cascade,
  instructor_id uuid references class_scheduler.instructors(id) on delete set null,
  class_request_id uuid references class_scheduler.class_requests(id) on delete set null,
  quantity int not null default 1,
  checked_out_on date not null default (now() at time zone 'Asia/Seoul')::date,
  due_on date,
  returned_on date,
  status class_scheduler.equipment_loan_status not null default '대여중',
  lost_damaged_qty int not null default 0,
  condition_memo text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table class_scheduler.equipment_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid not null references class_scheduler.equipment(id) on delete cascade,
  name text not null,
  unit text,
  total_quantity int not null default 0,
  low_stock_threshold int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table class_scheduler.equipment_loan_shortages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references class_scheduler.equipment_loans(id) on delete cascade,
  component_id uuid references class_scheduler.equipment_components(id) on delete set null,
  component_name text,
  shortage_qty int not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create table class_scheduler.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table class_scheduler.program_material_fees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_name text not null,
  fee_type text not null default 'fixed',
  amount numeric(12,0) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, program_name)
);

create table class_scheduler.program_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_name text not null,
  equipment_id uuid not null references class_scheduler.equipment(id) on delete cascade,
  quantity int not null default 1,
  created_at timestamptz not null default now(),
  unique (user_id, program_name, equipment_id)
);

create table class_scheduler.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'pending' check (role in ('admin', 'instructor', 'pending')),
  instructor_id uuid references class_scheduler.instructors(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  email text,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes supporting joins and policy predicates.
create index instructors_user_id_idx on class_scheduler.instructors(user_id);
create index clients_user_id_idx on class_scheduler.clients(user_id);
create index class_requests_user_id_idx on class_scheduler.class_requests(user_id);
create index class_requests_class_date_idx on class_scheduler.class_requests(class_date);
create index class_requests_status_idx on class_scheduler.class_requests(status);
create index equipment_user_id_idx on class_scheduler.equipment(user_id);
create index equipment_loans_user_id_idx on class_scheduler.equipment_loans(user_id);
create index equipment_loans_equipment_id_idx on class_scheduler.equipment_loans(equipment_id);
create index equipment_loans_instructor_id_idx on class_scheduler.equipment_loans(instructor_id);
create index equipment_loans_status_idx on class_scheduler.equipment_loans(status);
create index equipment_components_equipment_id_idx on class_scheduler.equipment_components(equipment_id);
create index equipment_components_user_id_idx on class_scheduler.equipment_components(user_id);
create index equipment_loan_shortages_loan_id_idx on class_scheduler.equipment_loan_shortages(loan_id);
create index equipment_loan_shortages_user_id_idx on class_scheduler.equipment_loan_shortages(user_id);
create index push_subscriptions_user_id_idx on class_scheduler.push_subscriptions(user_id);
create index program_material_fees_user_id_idx on class_scheduler.program_material_fees(user_id);
create index program_equipment_user_id_idx on class_scheduler.program_equipment(user_id);
create index program_equipment_equipment_id_idx on class_scheduler.program_equipment(equipment_id);
create index profiles_owner_id_idx on class_scheduler.profiles(owner_id);
create index profiles_role_idx on class_scheduler.profiles(role);
create index class_requests_instructor_id_idx on class_scheduler.class_requests(instructor_id);
create index class_requests_client_id_idx on class_scheduler.class_requests(client_id);
create index equipment_loans_class_request_id_idx on class_scheduler.equipment_loans(class_request_id);
create index equipment_loan_shortages_component_id_idx on class_scheduler.equipment_loan_shortages(component_id);
create unique index profiles_instructor_id_unique on class_scheduler.profiles(instructor_id) where instructor_id is not null;

-- Only a trusted deployment can set the scheduler owner. No client grants/policies.
create table class_scheduler_private.application_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table class_scheduler_private.application_owner enable row level security;

-- Invoker views preserve the original column names/calculations under table RLS.
create view class_scheduler.monthly_income with (security_invoker = true) as
with extras as (
  select
    r.id,
    r.user_id,
    to_char(r.class_date, 'YYYY-MM') as ym,
    coalesce(sum(case when (x->>'paid_to') = 'me' then (x->>'amount')::numeric else 0 end), 0) as my_extra_income,
    coalesce(sum(case when (x->>'paid_to') in ('instructor','client') then (x->>'amount')::numeric else 0 end), 0) as extra_costs
  from class_scheduler.class_requests r
  left join lateral jsonb_array_elements(coalesce(r.extra_fees, '[]'::jsonb)) as x on true
  where r.status in ('수업완료','정산완료') and r.class_date is not null
  group by r.id, r.user_id, to_char(r.class_date, 'YYYY-MM')
)
select
  r.user_id,
  to_char(r.class_date, 'YYYY-MM') as ym,
  sum(coalesce(r.fee_total,0)) as gross,
  sum(coalesce(r.instructor_payout,0)) as paid_to_instructors,
  sum(coalesce(r.my_commission,0)) as my_commission,
  coalesce(sum(e.my_extra_income), 0) as my_extra_income,
  coalesce(sum(e.extra_costs), 0) as extra_costs,
  sum(coalesce(r.my_commission,0)) + coalesce(sum(e.my_extra_income),0) as my_net
from class_scheduler.class_requests r
left join extras e on e.id = r.id
where r.status in ('수업완료','정산완료') and r.class_date is not null
group by r.user_id, to_char(r.class_date, 'YYYY-MM');

create view class_scheduler.equipment_stock with (security_invoker = true) as
select
  e.id as equipment_id,
  e.user_id,
  e.name,
  e.category,
  e.total_quantity,
  e.low_stock_threshold,
  e.active,
  coalesce(sum(l.quantity) filter (where l.status = '대여중'), 0) as checked_out,
  e.total_quantity - coalesce(sum(l.quantity) filter (where l.status = '대여중'), 0) as available,
  (e.total_quantity - coalesce(sum(l.quantity) filter (where l.status = '대여중'), 0))
    <= e.low_stock_threshold as needs_restock
from class_scheduler.equipment e
left join class_scheduler.equipment_loans l on l.equipment_id = e.id
group by e.id;

-- RLS lookups bypass only the profiles table recursion, for the calling Auth UID.
-- These functions live in a schema which is never exposed by the Data API.
create function class_scheduler_private.current_admin_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id
  from class_scheduler.profiles p
  join class_scheduler_private.application_owner a on a.user_id = p.id
  where (select auth.uid()) is not null and p.id = (select auth.uid())
    and p.role = 'admin' and p.owner_id = p.id;
$$;

create function class_scheduler_private.current_owner_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.owner_id
  from class_scheduler.profiles p
  join class_scheduler_private.application_owner a on a.user_id = p.owner_id
  where (select auth.uid()) is not null and p.id = (select auth.uid())
    and ((p.role = 'admin' and p.id = p.owner_id)
      or (p.role = 'instructor' and p.instructor_id is not null));
$$;

create function class_scheduler_private.current_instructor_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.instructor_id
  from class_scheduler.profiles p
  join class_scheduler_private.application_owner a on a.user_id = p.owner_id
  where (select auth.uid()) is not null and p.id = (select auth.uid())
    and p.role = 'instructor' and p.instructor_id is not null;
$$;

-- Preserve the original simple foreign keys for PostgREST joins, while checking
-- that linked rows have the same scheduler owner. This function is an invoker.
create function class_scheduler_private.check_owner_links() returns trigger
language plpgsql set search_path = '' as $$
declare v_equipment_id uuid;
begin
  if tg_table_name = 'class_requests' then
    if new.client_id is not null and not exists (
      select 1 from class_scheduler.clients x where x.id = new.client_id and x.user_id = new.user_id
    ) then raise exception 'Client belongs to a different scheduler owner.' using errcode = '23514'; end if;
    if new.instructor_id is not null and not exists (
      select 1 from class_scheduler.instructors x where x.id = new.instructor_id and x.user_id = new.user_id
    ) then raise exception 'Instructor belongs to a different scheduler owner.' using errcode = '23514'; end if;
  elsif tg_table_name = 'equipment_loans' then
    if not exists (
      select 1 from class_scheduler.equipment x where x.id = new.equipment_id and x.user_id = new.user_id
    ) then raise exception 'Equipment belongs to a different scheduler owner.' using errcode = '23514'; end if;
    if new.instructor_id is not null and not exists (
      select 1 from class_scheduler.instructors x where x.id = new.instructor_id and x.user_id = new.user_id
    ) then raise exception 'Instructor belongs to a different scheduler owner.' using errcode = '23514'; end if;
    if new.class_request_id is not null and not exists (
      select 1 from class_scheduler.class_requests x where x.id = new.class_request_id and x.user_id = new.user_id
    ) then raise exception 'Class belongs to a different scheduler owner.' using errcode = '23514'; end if;
  elsif tg_table_name in ('equipment_components', 'program_equipment') then
    if not exists (
      select 1 from class_scheduler.equipment x where x.id = new.equipment_id and x.user_id = new.user_id
    ) then raise exception 'Equipment belongs to a different scheduler owner.' using errcode = '23514'; end if;
  elsif tg_table_name = 'equipment_loan_shortages' then
    select x.equipment_id into v_equipment_id from class_scheduler.equipment_loans x
      where x.id = new.loan_id and x.user_id = new.user_id;
    if v_equipment_id is null then
      raise exception 'Loan belongs to a different scheduler owner.' using errcode = '23514';
    end if;
    if new.component_id is not null and not exists (
      select 1 from class_scheduler.equipment_components x
      where x.id = new.component_id and x.user_id = new.user_id and x.equipment_id = v_equipment_id
    ) then raise exception 'Component does not belong to the loaned equipment.' using errcode = '23514'; end if;
  elsif tg_table_name = 'profiles' then
    if new.instructor_id is not null and not exists (
      select 1 from class_scheduler.instructors x where x.id = new.instructor_id and x.user_id = new.owner_id
    ) then raise exception 'Instructor belongs to a different scheduler owner.' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;

create trigger class_requests_check_owner_links before insert or update on class_scheduler.class_requests
  for each row execute function class_scheduler_private.check_owner_links();
create trigger equipment_loans_check_owner_links before insert or update on class_scheduler.equipment_loans
  for each row execute function class_scheduler_private.check_owner_links();
create trigger equipment_components_check_owner_links before insert or update on class_scheduler.equipment_components
  for each row execute function class_scheduler_private.check_owner_links();
create trigger program_equipment_check_owner_links before insert or update on class_scheduler.program_equipment
  for each row execute function class_scheduler_private.check_owner_links();
create trigger shortages_check_owner_links before insert or update on class_scheduler.equipment_loan_shortages
  for each row execute function class_scheduler_private.check_owner_links();
create trigger profiles_check_owner_links before insert or update on class_scheduler.profiles
  for each row execute function class_scheduler_private.check_owner_links();

create function class_scheduler_private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger instructors_set_updated_at before update on class_scheduler.instructors
  for each row execute function class_scheduler_private.set_updated_at();
create trigger clients_set_updated_at before update on class_scheduler.clients
  for each row execute function class_scheduler_private.set_updated_at();
create trigger class_requests_set_updated_at before update on class_scheduler.class_requests
  for each row execute function class_scheduler_private.set_updated_at();
create trigger equipment_set_updated_at before update on class_scheduler.equipment
  for each row execute function class_scheduler_private.set_updated_at();
create trigger equipment_loans_set_updated_at before update on class_scheduler.equipment_loans
  for each row execute function class_scheduler_private.set_updated_at();
create trigger equipment_components_set_updated_at before update on class_scheduler.equipment_components
  for each row execute function class_scheduler_private.set_updated_at();
create trigger profiles_set_updated_at before update on class_scheduler.profiles
  for each row execute function class_scheduler_private.set_updated_at();

-- Every exposed table has RLS. Pending / unrelated shared Auth users have no
-- scheduler business-data access, even when they supply their own user_id.
alter table class_scheduler.instructors enable row level security;
alter table class_scheduler.clients enable row level security;
alter table class_scheduler.class_requests enable row level security;
alter table class_scheduler.equipment enable row level security;
alter table class_scheduler.equipment_loans enable row level security;
alter table class_scheduler.equipment_components enable row level security;
alter table class_scheduler.equipment_loan_shortages enable row level security;
alter table class_scheduler.push_subscriptions enable row level security;
alter table class_scheduler.program_material_fees enable row level security;
alter table class_scheduler.program_equipment enable row level security;
alter table class_scheduler.profiles enable row level security;

create policy instructors_owner_all on class_scheduler.instructors for all to authenticated
  using (user_id = (select class_scheduler_private.current_admin_id()))
  with check (user_id = (select class_scheduler_private.current_admin_id()));
create policy clients_owner_all on class_scheduler.clients for all to authenticated
  using (user_id = (select class_scheduler_private.current_admin_id()))
  with check (user_id = (select class_scheduler_private.current_admin_id()));
create policy class_requests_owner_all on class_scheduler.class_requests for all to authenticated
  using (user_id = (select class_scheduler_private.current_admin_id()))
  with check (user_id = (select class_scheduler_private.current_admin_id()));
create policy equipment_owner_all on class_scheduler.equipment for all to authenticated
  using (user_id = (select class_scheduler_private.current_admin_id()))
  with check (user_id = (select class_scheduler_private.current_admin_id()));
create policy equipment_loans_owner_all on class_scheduler.equipment_loans for all to authenticated
  using (user_id = (select class_scheduler_private.current_admin_id()))
  with check (user_id = (select class_scheduler_private.current_admin_id()));
create policy equipment_components_owner_all on class_scheduler.equipment_components for all to authenticated
  using (user_id = (select class_scheduler_private.current_admin_id()))
  with check (user_id = (select class_scheduler_private.current_admin_id()));
create policy equipment_loan_shortages_owner_all on class_scheduler.equipment_loan_shortages for all to authenticated
  using (user_id = (select class_scheduler_private.current_admin_id()))
  with check (user_id = (select class_scheduler_private.current_admin_id()));
create policy program_material_fees_owner_all on class_scheduler.program_material_fees for all to authenticated
  using (user_id = (select class_scheduler_private.current_admin_id()))
  with check (user_id = (select class_scheduler_private.current_admin_id()));
create policy program_equipment_owner_all on class_scheduler.program_equipment for all to authenticated
  using (user_id = (select class_scheduler_private.current_admin_id()))
  with check (user_id = (select class_scheduler_private.current_admin_id()));
create policy push_subscriptions_member_own on class_scheduler.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()) and (select class_scheduler_private.current_owner_id()) is not null)
  with check (user_id = (select auth.uid()) and (select class_scheduler_private.current_owner_id()) is not null);

create policy profiles_self_or_owner_read on class_scheduler.profiles for select to authenticated
  using (id = (select auth.uid()) or owner_id = (select class_scheduler_private.current_admin_id()));
create policy instructors_self_read on class_scheduler.instructors for select to authenticated
  using (id = (select class_scheduler_private.current_instructor_id())
    and user_id = (select class_scheduler_private.current_owner_id()));
create policy class_requests_instructor_read on class_scheduler.class_requests for select to authenticated
  using (instructor_id = (select class_scheduler_private.current_instructor_id())
    and user_id = (select class_scheduler_private.current_owner_id()));
create policy equipment_instructor_read on class_scheduler.equipment for select to authenticated
  using ((select class_scheduler_private.current_instructor_id()) is not null
    and user_id = (select class_scheduler_private.current_owner_id()));
create policy equipment_components_instructor_read on class_scheduler.equipment_components for select to authenticated
  using ((select class_scheduler_private.current_instructor_id()) is not null
    and user_id = (select class_scheduler_private.current_owner_id()));
create policy program_equipment_instructor_read on class_scheduler.program_equipment for select to authenticated
  using ((select class_scheduler_private.current_instructor_id()) is not null
    and user_id = (select class_scheduler_private.current_owner_id()));
create policy equipment_loans_instructor_read on class_scheduler.equipment_loans for select to authenticated
  using (instructor_id = (select class_scheduler_private.current_instructor_id())
    and user_id = (select class_scheduler_private.current_owner_id()));
create policy shortages_instructor_read on class_scheduler.equipment_loan_shortages for select to authenticated
  using (user_id = (select class_scheduler_private.current_owner_id()) and exists (
    select 1 from class_scheduler.equipment_loans l
    where l.id = loan_id and l.instructor_id = (select class_scheduler_private.current_instructor_id())
      and l.user_id = (select class_scheduler_private.current_owner_id())
  ));

-- Only an explicit scheduler request creates a profile. Shared Auth signups do
-- not run scheduler triggers. User-provided names never confer permissions.
create function class_scheduler_private.ensure_profile(p_display_name text default null)
returns setof class_scheduler.profiles
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_email text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if exists (select 1 from class_scheduler.profiles p where p.id = v_uid) then
    return query select p.* from class_scheduler.profiles p where p.id = v_uid;
    return;
  end if;
  select a.user_id into v_owner from class_scheduler_private.application_owner a where a.singleton;
  if v_owner is null then raise exception '스케줄러 관리자 설정이 필요합니다.' using errcode = '55000'; end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  if not found then raise exception '인증 계정을 확인할 수 없습니다.' using errcode = '42501'; end if;
  insert into class_scheduler.profiles(id, role, owner_id, email, display_name)
    values (v_uid, 'pending', v_owner, v_email, coalesce(nullif(left(btrim(p_display_name), 200), ''), v_email))
    on conflict (id) do nothing;
  return query select p.* from class_scheduler.profiles p where p.id = v_uid;
end;
$$;

create function class_scheduler_private.approve_member(
  p_profile_id uuid, p_instructor_id uuid default null, p_new_name text default null
) returns setof class_scheduler.profiles
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := class_scheduler_private.current_admin_id(); v_instructor uuid := p_instructor_id;
begin
  if auth.uid() is null or v_owner is null then raise exception '관리자 권한이 필요합니다.' using errcode = '42501'; end if;
  perform 1 from class_scheduler.profiles p
    where p.id = p_profile_id and p.owner_id = v_owner and p.role <> 'admin' and p.id <> v_owner
    for update;
  if not found then raise exception '승인할 스케줄러 회원을 찾을 수 없습니다.' using errcode = '42501'; end if;
  if v_instructor is null then
    if nullif(btrim(p_new_name), '') is null then
      raise exception '연결할 강사를 선택하거나 이름을 입력하세요.' using errcode = '22023';
    end if;
    insert into class_scheduler.instructors(user_id, name, active)
      values (v_owner, left(btrim(p_new_name), 200), true) returning id into v_instructor;
  else
    perform 1 from class_scheduler.instructors i where i.id = v_instructor and i.user_id = v_owner for update;
    if not found then raise exception '연결할 강사를 찾을 수 없습니다.' using errcode = '42501'; end if;
  end if;
  if exists (select 1 from class_scheduler.profiles p where p.instructor_id = v_instructor and p.id <> p_profile_id) then
    raise exception '이미 다른 계정에 연결된 강사입니다.' using errcode = '23505';
  end if;
  return query update class_scheduler.profiles p set role = 'instructor', instructor_id = v_instructor
    where p.id = p_profile_id and p.owner_id = v_owner returning p.*;
end;
$$;

create function class_scheduler_private.revoke_member(p_profile_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := class_scheduler_private.current_admin_id();
begin
  if auth.uid() is null or v_owner is null then raise exception '관리자 권한이 필요합니다.' using errcode = '42501'; end if;
  update class_scheduler.profiles p set role = 'pending', instructor_id = null
    where p.id = p_profile_id and p.owner_id = v_owner and p.role <> 'admin' and p.id <> v_owner;
  if not found then raise exception '연결을 해제할 스케줄러 회원을 찾을 수 없습니다.' using errcode = '42501'; end if;
end;
$$;

create function class_scheduler_private.remove_member(p_profile_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := class_scheduler_private.current_admin_id();
begin
  if auth.uid() is null or v_owner is null then raise exception '관리자 권한이 필요합니다.' using errcode = '42501'; end if;
  delete from class_scheduler.profiles p
    where p.id = p_profile_id and p.owner_id = v_owner and p.role <> 'admin' and p.id <> v_owner;
  if not found then raise exception '삭제할 스케줄러 회원을 찾을 수 없습니다.' using errcode = '42501'; end if;
  -- Deliberately never deletes auth.users or modifies shared credentials.
end;
$$;

create function class_scheduler_private.enroll_member_by_email(
  p_email text, p_name text, p_instructor_id uuid default null
) returns setof class_scheduler.profiles
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := class_scheduler_private.current_admin_id(); v_uid uuid; v_email text;
begin
  if auth.uid() is null or v_owner is null then raise exception '관리자 권한이 필요합니다.' using errcode = '42501'; end if;
  select u.id, u.email into v_uid, v_email from auth.users u
    where lower(u.email) = lower(btrim(p_email)) and u.email_confirmed_at is not null;
  if v_uid is null then
    raise exception '먼저 가입하고 이메일 인증을 완료한 계정을 연결하세요.' using errcode = '22023';
  end if;
  if v_uid = v_owner then raise exception '관리자 본인을 강사로 연결할 수 없습니다.' using errcode = '42501'; end if;
  insert into class_scheduler.profiles(id, role, owner_id, email, display_name)
    values (v_uid, 'pending', v_owner, v_email, coalesce(nullif(left(btrim(p_name), 200), ''), v_email))
    on conflict (id) do nothing;
  return query select * from class_scheduler_private.approve_member(v_uid, p_instructor_id, p_name);
end;
$$;

-- One transaction returns an assigned loan and records shortages. Instructors
-- cannot change quantities, owner IDs, equipment IDs or another user's loan.
create function class_scheduler_private.return_my_loan(
  p_loan_id uuid, p_returned_on date default null, p_condition_memo text default null,
  p_shortages jsonb default '[]'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := class_scheduler_private.current_owner_id();
  v_instructor uuid := class_scheduler_private.current_instructor_id();
  v_loan class_scheduler.equipment_loans%rowtype;
  v_shortages jsonb := coalesce(p_shortages, '[]'::jsonb);
begin
  if auth.uid() is null or v_owner is null or v_instructor is null then
    raise exception '승인된 강사 계정으로 로그인하세요.' using errcode = '42501';
  end if;
  select l.* into v_loan from class_scheduler.equipment_loans l
    where l.id = p_loan_id and l.user_id = v_owner and l.instructor_id = v_instructor for update;
  if not found then raise exception '반납할 대여 내역을 찾을 수 없습니다.' using errcode = '42501'; end if;
  if v_loan.status <> '대여중' then raise exception '이미 반납 처리된 내역입니다.' using errcode = '22023'; end if;
  if jsonb_typeof(v_shortages) <> 'array' then raise exception '부족 내역 형식이 올바르지 않습니다.' using errcode = '22023'; end if;
  if jsonb_array_length(v_shortages) > 100 then raise exception '부족 내역은 100개까지 입력할 수 있습니다.' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_to_recordset(v_shortages) as s(component_id uuid, shortage_qty integer)
    where s.shortage_qty is null or s.shortage_qty <= 0 or s.component_id is null
      or not exists (select 1 from class_scheduler.equipment_components c
        where c.id = s.component_id and c.user_id = v_owner and c.equipment_id = v_loan.equipment_id)
  ) then raise exception '부족 수량 또는 구성품이 올바르지 않습니다.' using errcode = '22023'; end if;
  update class_scheduler.equipment_loans set status = '반납완료',
    returned_on = coalesce(p_returned_on, (now() at time zone 'Asia/Seoul')::date),
    condition_memo = p_condition_memo where id = p_loan_id;
  insert into class_scheduler.equipment_loan_shortages(user_id, loan_id, component_id, component_name, shortage_qty, note)
    select v_owner, p_loan_id, s.component_id, c.name, s.shortage_qty, s.note
    from jsonb_to_recordset(v_shortages) as s(component_id uuid, shortage_qty integer, note text)
    join class_scheduler.equipment_components c on c.id = s.component_id;
end;
$$;

-- Exposed RPCs are invoker wrappers. Private implementations enforce auth.uid()
-- and scheduler role on every invocation. No client can set its own role/owner.
create function class_scheduler.ensure_profile(p_display_name text default null)
returns setof class_scheduler.profiles language sql security invoker set search_path = '' as $$
  select * from class_scheduler_private.ensure_profile(p_display_name);
$$;
create function class_scheduler.approve_member(
  p_profile_id uuid, p_instructor_id uuid default null, p_new_name text default null
) returns setof class_scheduler.profiles language sql security invoker set search_path = '' as $$
  select * from class_scheduler_private.approve_member(p_profile_id, p_instructor_id, p_new_name);
$$;
create function class_scheduler.revoke_member(p_profile_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select class_scheduler_private.revoke_member(p_profile_id);
$$;
create function class_scheduler.remove_member(p_profile_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select class_scheduler_private.remove_member(p_profile_id);
$$;
create function class_scheduler.enroll_member_by_email(p_email text, p_name text, p_instructor_id uuid default null)
returns setof class_scheduler.profiles language sql security invoker set search_path = '' as $$
  select * from class_scheduler_private.enroll_member_by_email(p_email, p_name, p_instructor_id);
$$;
create function class_scheduler.return_my_loan(
  p_loan_id uuid, p_returned_on date default null, p_condition_memo text default null,
  p_shortages jsonb default '[]'::jsonb
) returns void language sql security invoker set search_path = '' as $$
  select class_scheduler_private.return_my_loan(p_loan_id, p_returned_on, p_condition_memo, p_shortages);
$$;

-- Explicit grants, scoped ONLY to these two new schemas. Anonymous requests get
-- neither table access nor RPC access. Auth signup/sign-in are separate APIs.
revoke all on all tables in schema class_scheduler from public, anon, authenticated, service_role;
revoke all on all tables in schema class_scheduler_private from public, anon, authenticated, service_role;
revoke all on all functions in schema class_scheduler from public, anon, authenticated, service_role;
revoke all on all functions in schema class_scheduler_private from public, anon, authenticated, service_role;
grant usage on schema class_scheduler to authenticated, service_role;
grant usage on schema class_scheduler_private to authenticated;
grant select, insert, update, delete on
  class_scheduler.instructors, class_scheduler.clients, class_scheduler.class_requests,
  class_scheduler.equipment, class_scheduler.equipment_loans, class_scheduler.equipment_components,
  class_scheduler.equipment_loan_shortages, class_scheduler.push_subscriptions,
  class_scheduler.program_material_fees, class_scheduler.program_equipment to authenticated;
grant select on class_scheduler.profiles, class_scheduler.monthly_income, class_scheduler.equipment_stock to authenticated;
grant all on all tables in schema class_scheduler to service_role;
grant execute on function
  class_scheduler_private.current_admin_id(), class_scheduler_private.current_owner_id(),
  class_scheduler_private.current_instructor_id(), class_scheduler_private.ensure_profile(text),
  class_scheduler_private.approve_member(uuid, uuid, text), class_scheduler_private.revoke_member(uuid),
  class_scheduler_private.remove_member(uuid), class_scheduler_private.enroll_member_by_email(text, text, uuid),
  class_scheduler_private.return_my_loan(uuid, date, text, jsonb) to authenticated;
grant execute on all functions in schema class_scheduler to authenticated;

-- Repeat the explicit REVOKE/GRANT block for every future object migration.
-- Schema-scoped default-privilege revokes cannot cancel global default grants
-- (notably PUBLIC EXECUTE on functions). Shared-project global defaults stay intact.

-- Apply the separately reviewed owner seed and append ONLY class_scheduler to
-- the existing Exposed schemas list. Never expose class_scheduler_private.
notify pgrst, 'reload schema';

