-- 0006_profiles_roles.sql
-- 강사 로그인 + 역할(슈퍼관리자 / 강사 / 승인대기) + 강사용 접근 권한(RLS)
-- Supabase SQL Editor에서 실행하세요. (idempotent)
--
-- 주의: 이 마이그레이션은 "기존 로그인 사용자 = 관리자"로 지정합니다.
-- 반드시 강사가 가입하기 전에 먼저 실행하세요.

-- 1) 프로필 (역할 + 강사 연결)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'pending',            -- 'admin' | 'instructor' | 'pending'
  instructor_id uuid references public.instructors(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null, -- 소속 관리자
  email text,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_owner_id_idx on public.profiles(owner_id);
create index if not exists profiles_role_idx on public.profiles(role);

alter table public.profiles enable row level security;

-- 2) 헬퍼 함수 (security definer → profiles RLS 우회, 재귀 방지)
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

-- 3) profiles 정책 (본인 프로필 읽기 / 관리자 전체 관리)
--    ※ 본인이 role 을 바꾸지 못하도록 self-update 정책은 두지 않습니다.
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select using (public.user_role() = 'admin');

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.user_role() = 'admin') with check (public.user_role() = 'admin');

-- 4) 신규 가입 → 자동 프로필(승인대기) 생성
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare admin_id uuid;
begin
  select id into admin_id from public.profiles where role = 'admin' order by created_at limit 1;
  insert into public.profiles (id, role, owner_id, email, display_name)
  values (
    new.id,
    'pending',
    admin_id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) 기존 사용자 = 관리자 부트스트랩 (지금은 사장님 한 명뿐이므로 안전)
insert into public.profiles (id, role, owner_id, email)
select u.id, 'admin', u.id, u.email from auth.users u
on conflict (id) do nothing;

-- updated_at 트리거
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- 6) 강사용 접근 권한 (기존 관리자 정책은 그대로 두고 추가)
--    permissive 정책은 OR 로 합쳐지므로, 관리자/강사 모두 각자 볼 수 있습니다.
-- ============================================================

-- 내 수업(강사 배정된 것)
drop policy if exists "class_requests_instructor_select" on public.class_requests;
create policy "class_requests_instructor_select" on public.class_requests
  for select using (instructor_id = public.current_instructor_id());

-- 내 강사 정보
drop policy if exists "instructors_instructor_self" on public.instructors;
create policy "instructors_instructor_self" on public.instructors
  for select using (id = public.current_instructor_id());

-- 교구/구성품/프로그램교구 읽기 (소속 관리자 것)
drop policy if exists "equipment_instructor_select" on public.equipment;
create policy "equipment_instructor_select" on public.equipment
  for select using (user_id = public.user_owner());

drop policy if exists "equipment_components_instructor_select" on public.equipment_components;
create policy "equipment_components_instructor_select" on public.equipment_components
  for select using (user_id = public.user_owner());

drop policy if exists "program_equipment_instructor_select" on public.program_equipment;
create policy "program_equipment_instructor_select" on public.program_equipment
  for select using (user_id = public.user_owner());

-- 내 대여 교구: 읽기 + 반납 처리(update)
drop policy if exists "equipment_loans_instructor_select" on public.equipment_loans;
create policy "equipment_loans_instructor_select" on public.equipment_loans
  for select using (instructor_id = public.current_instructor_id());

drop policy if exists "equipment_loans_instructor_update" on public.equipment_loans;
create policy "equipment_loans_instructor_update" on public.equipment_loans
  for update using (instructor_id = public.current_instructor_id())
  with check (instructor_id = public.current_instructor_id());

-- 반납 시 부족 기록: 내 대여건에 대해 읽기 + 남기기(insert)
drop policy if exists "shortages_instructor_select" on public.equipment_loan_shortages;
create policy "shortages_instructor_select" on public.equipment_loan_shortages
  for select using (
    exists (select 1 from public.equipment_loans l
            where l.id = loan_id and l.instructor_id = public.current_instructor_id())
  );

drop policy if exists "shortages_instructor_insert" on public.equipment_loan_shortages;
create policy "shortages_instructor_insert" on public.equipment_loan_shortages
  for insert with check (
    user_id = public.user_owner()
    and exists (select 1 from public.equipment_loans l
                where l.id = loan_id and l.instructor_id = public.current_instructor_id())
  );
