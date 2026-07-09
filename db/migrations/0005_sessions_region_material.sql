-- 0005_sessions_region_material.sql
-- 차시(sessions)·지역(region) + 프로그램별 재료비 규칙
-- Supabase SQL Editor에서 실행하세요. (idempotent)

-- 수업에 차시·지역 추가
alter table public.class_requests add column if not exists sessions int not null default 1;
alter table public.class_requests add column if not exists region text;

-- 프로그램(과목)별 재료비 규칙 → 내 수입
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
