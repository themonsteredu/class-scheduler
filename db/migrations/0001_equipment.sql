-- 0001_equipment.sql
-- 교구(敎具) 관리 — 대장 + 대여/반납 이력
-- Supabase SQL Editor에서 실행하세요. 여러 번 실행해도 안전합니다(idempotent).

-- 대여 상태 enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_loan_status') then
    create type equipment_loan_status as enum ('대여중','반납완료');
  end if;
end$$;

-- 교구 대장
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

-- 대여·반납 이력
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

-- RLS (본인 데이터만)
alter table public.equipment enable row level security;
alter table public.equipment_loans enable row level security;

drop policy if exists "equipment_owner_all" on public.equipment;
create policy "equipment_owner_all" on public.equipment
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "equipment_loans_owner_all" on public.equipment_loans;
create policy "equipment_loans_owner_all" on public.equipment_loans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 재고 뷰: 여유 = 총 보유 − 대여중. 보충기준 이하면 needs_restock = true.
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

-- updated_at 자동 갱신
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

drop trigger if exists equipment_loans_set_updated_at on public.equipment_loans;
create trigger equipment_loans_set_updated_at before update on public.equipment_loans
  for each row execute function public.set_updated_at();
