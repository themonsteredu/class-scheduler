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
