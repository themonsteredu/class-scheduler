-- 0002_equipment_components.sql
-- 교구 구성품(부품) 단위 관리 + 반납 시 구성품별 부족·파손 기록
-- 0001_equipment.sql 실행 후에 Supabase SQL Editor에서 실행하세요. (idempotent)

-- 구성품: 교구 하나를 이루는 부품별 보유 수량/보충 기준
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

-- 반납 시 구성품별 부족·파손 기록 (이력 보존용 스냅샷 component_name 포함)
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

-- RLS (본인 데이터만)
alter table public.equipment_components enable row level security;
alter table public.equipment_loan_shortages enable row level security;

drop policy if exists "equipment_components_owner_all" on public.equipment_components;
create policy "equipment_components_owner_all" on public.equipment_components
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "equipment_loan_shortages_owner_all" on public.equipment_loan_shortages;
create policy "equipment_loan_shortages_owner_all" on public.equipment_loan_shortages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at 자동 갱신 (0001에서 이미 만들었다면 재정의만 됨)
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

drop trigger if exists equipment_components_set_updated_at on public.equipment_components;
create trigger equipment_components_set_updated_at before update on public.equipment_components
  for each row execute function public.set_updated_at();
