-- Class Scheduler schema (Supabase / Postgres)
-- Apply via Supabase SQL Editor.

-- Status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'class_request_status') then
    create type class_request_status as enum (
      '의뢰접수','강사확정','수업완료','정산완료','취소'
    );
  end if;
end$$;

-- Instructors
create table if not exists public.instructors (
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

create index if not exists instructors_user_id_idx on public.instructors(user_id);

-- Clients
create table if not exists public.clients (
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

create index if not exists clients_user_id_idx on public.clients(user_id);

-- Class requests
create table if not exists public.class_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  instructor_id uuid references public.instructors(id) on delete set null,
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
  status class_request_status not null default '의뢰접수',
  raw_message text,
  parsed_meta jsonb,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_requests_user_id_idx on public.class_requests(user_id);
create index if not exists class_requests_class_date_idx on public.class_requests(class_date);
create index if not exists class_requests_status_idx on public.class_requests(status);

-- RLS
alter table public.instructors enable row level security;
alter table public.clients enable row level security;
alter table public.class_requests enable row level security;

drop policy if exists "instructors_owner_all" on public.instructors;
create policy "instructors_owner_all" on public.instructors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "clients_owner_all" on public.clients;
create policy "clients_owner_all" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "class_requests_owner_all" on public.class_requests;
create policy "class_requests_owner_all" on public.class_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Monthly income view (only '수업완료'/'정산완료').
-- Extras: paid_to='me' → my_extra_income, paid_to in ('instructor','client') → extra_costs.
create or replace view public.monthly_income as
with extras as (
  select
    r.id,
    r.user_id,
    to_char(r.class_date, 'YYYY-MM') as ym,
    coalesce(sum(case when (x->>'paid_to') = 'me' then (x->>'amount')::numeric else 0 end), 0) as my_extra_income,
    coalesce(sum(case when (x->>'paid_to') in ('instructor','client') then (x->>'amount')::numeric else 0 end), 0) as extra_costs
  from public.class_requests r
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
from public.class_requests r
left join extras e on e.id = r.id
where r.status in ('수업완료','정산완료') and r.class_date is not null
group by r.user_id, to_char(r.class_date, 'YYYY-MM');

-- ============================================================
-- 교구(敎具) 관리 — Equipment tracking (간단형)
-- ============================================================

-- Loan status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_loan_status') then
    create type equipment_loan_status as enum ('대여중','반납완료');
  end if;
end$$;

-- Equipment master (교구 대장)
create table if not exists public.equipment (
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

create index if not exists equipment_user_id_idx on public.equipment(user_id);

-- Equipment loans (대여·반납 이력)
create table if not exists public.equipment_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  instructor_id uuid references public.instructors(id) on delete set null,
  class_request_id uuid references public.class_requests(id) on delete set null,
  quantity int not null default 1,
  checked_out_on date not null default (now() at time zone 'Asia/Seoul')::date,
  due_on date,
  returned_on date,
  status equipment_loan_status not null default '대여중',
  lost_damaged_qty int not null default 0,
  condition_memo text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_loans_user_id_idx on public.equipment_loans(user_id);
create index if not exists equipment_loans_equipment_id_idx on public.equipment_loans(equipment_id);
create index if not exists equipment_loans_instructor_id_idx on public.equipment_loans(instructor_id);
create index if not exists equipment_loans_status_idx on public.equipment_loans(status);

-- RLS
alter table public.equipment enable row level security;
alter table public.equipment_loans enable row level security;

drop policy if exists "equipment_owner_all" on public.equipment;
create policy "equipment_owner_all" on public.equipment
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "equipment_loans_owner_all" on public.equipment_loans;
create policy "equipment_loans_owner_all" on public.equipment_loans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Stock view: available = total - currently checked out. needs_restock when <= threshold.
create or replace view public.equipment_stock as
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
from public.equipment e
left join public.equipment_loans l on l.equipment_id = e.id
group by e.id;

-- Equipment components (구성품 — 교구 하나를 이루는 부품별 수량/보충 관리)
create table if not exists public.equipment_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  name text not null,
  unit text,
  total_quantity int not null default 0,
  low_stock_threshold int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_components_equipment_id_idx on public.equipment_components(equipment_id);
create index if not exists equipment_components_user_id_idx on public.equipment_components(user_id);

-- Loan component shortages (반납 시 구성품별 부족·파손 기록)
create table if not exists public.equipment_loan_shortages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.equipment_loans(id) on delete cascade,
  component_id uuid references public.equipment_components(id) on delete set null,
  component_name text,
  shortage_qty int not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists equipment_loan_shortages_loan_id_idx on public.equipment_loan_shortages(loan_id);
create index if not exists equipment_loan_shortages_user_id_idx on public.equipment_loan_shortages(user_id);

alter table public.equipment_components enable row level security;
alter table public.equipment_loan_shortages enable row level security;

drop policy if exists "equipment_components_owner_all" on public.equipment_components;
create policy "equipment_components_owner_all" on public.equipment_components
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "equipment_loan_shortages_owner_all" on public.equipment_loan_shortages;
create policy "equipment_loan_shortages_owner_all" on public.equipment_loan_shortages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Web push subscriptions (교구 부족 알림용)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_owner_all" on public.push_subscriptions;
create policy "push_subscriptions_owner_all" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Program material fees (프로그램(과목)별 재료비 규칙 → 내 수입)
-- fee_type: 'fixed'(수업당 고정) | 'per_person'(인당)
create table if not exists public.program_material_fees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_name text not null,
  fee_type text not null default 'fixed',
  amount numeric(12,0) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, program_name)
);

create index if not exists program_material_fees_user_id_idx on public.program_material_fees(user_id);

alter table public.program_material_fees enable row level security;

drop policy if exists "program_material_fees_owner_all" on public.program_material_fees;
create policy "program_material_fees_owner_all" on public.program_material_fees
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Program → equipment mapping (프로그램(과목) 이름마다 필요한 교구 고정)
create table if not exists public.program_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_name text not null,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  quantity int not null default 1,
  created_at timestamptz not null default now(),
  unique (user_id, program_name, equipment_id)
);

create index if not exists program_equipment_user_id_idx on public.program_equipment(user_id);
create index if not exists program_equipment_equipment_id_idx on public.program_equipment(equipment_id);

alter table public.program_equipment enable row level security;

drop policy if exists "program_equipment_owner_all" on public.program_equipment;
create policy "program_equipment_owner_all" on public.program_equipment
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger helper
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

drop trigger if exists instructors_set_updated_at on public.instructors;
create trigger instructors_set_updated_at before update on public.instructors
  for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists class_requests_set_updated_at on public.class_requests;
create trigger class_requests_set_updated_at before update on public.class_requests
  for each row execute function public.set_updated_at();

drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

drop trigger if exists equipment_loans_set_updated_at on public.equipment_loans;
create trigger equipment_loans_set_updated_at before update on public.equipment_loans
  for each row execute function public.set_updated_at();

drop trigger if exists equipment_components_set_updated_at on public.equipment_components;
create trigger equipment_components_set_updated_at before update on public.equipment_components
  for each row execute function public.set_updated_at();

-- ============================================================
-- 역할 / 강사 로그인 (profiles) — 자세한 내용: db/migrations/0006
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'pending',
  instructor_id uuid references public.instructors(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  email text,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_owner_id_idx on public.profiles(owner_id);
create index if not exists profiles_role_idx on public.profiles(role);
alter table public.profiles enable row level security;

create or replace function public.user_role() returns text
  language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
create or replace function public.current_instructor_id() returns uuid
  language sql security definer stable set search_path = public as $$
  select instructor_id from public.profiles where id = auth.uid() and role = 'instructor';
$$;
create or replace function public.user_owner() returns uuid
  language sql security definer stable set search_path = public as $$
  select owner_id from public.profiles where id = auth.uid();
$$;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles for select using (public.user_role() = 'admin');
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update
  using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare admin_id uuid;
begin
  select id into admin_id from public.profiles where role = 'admin' order by created_at limit 1;
  insert into public.profiles (id, role, owner_id, email, display_name)
  values (new.id, 'pending', admin_id, new.email,
          coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- 강사용 접근 권한 (관리자 정책과 OR)
drop policy if exists "class_requests_instructor_select" on public.class_requests;
create policy "class_requests_instructor_select" on public.class_requests
  for select using (instructor_id = public.current_instructor_id());
drop policy if exists "instructors_instructor_self" on public.instructors;
create policy "instructors_instructor_self" on public.instructors
  for select using (id = public.current_instructor_id());
drop policy if exists "equipment_instructor_select" on public.equipment;
create policy "equipment_instructor_select" on public.equipment
  for select using (user_id = public.user_owner());
drop policy if exists "equipment_components_instructor_select" on public.equipment_components;
create policy "equipment_components_instructor_select" on public.equipment_components
  for select using (user_id = public.user_owner());
drop policy if exists "program_equipment_instructor_select" on public.program_equipment;
create policy "program_equipment_instructor_select" on public.program_equipment
  for select using (user_id = public.user_owner());
drop policy if exists "equipment_loans_instructor_select" on public.equipment_loans;
create policy "equipment_loans_instructor_select" on public.equipment_loans
  for select using (instructor_id = public.current_instructor_id());
drop policy if exists "equipment_loans_instructor_update" on public.equipment_loans;
create policy "equipment_loans_instructor_update" on public.equipment_loans
  for update using (instructor_id = public.current_instructor_id())
  with check (instructor_id = public.current_instructor_id());
drop policy if exists "shortages_instructor_select" on public.equipment_loan_shortages;
create policy "shortages_instructor_select" on public.equipment_loan_shortages
  for select using (exists (select 1 from public.equipment_loans l
    where l.id = loan_id and l.instructor_id = public.current_instructor_id()));
drop policy if exists "shortages_instructor_insert" on public.equipment_loan_shortages;
create policy "shortages_instructor_insert" on public.equipment_loan_shortages
  for insert with check (user_id = public.user_owner()
    and exists (select 1 from public.equipment_loans l
      where l.id = loan_id and l.instructor_id = public.current_instructor_id()));
