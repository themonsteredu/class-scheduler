-- 0004_program_equipment.sql
-- 프로그램(과목) 이름마다 필요한 교구를 고정 매핑 → 요일별 교구 스케쥴에 사용
-- Supabase SQL Editor에서 실행하세요. (idempotent)

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
