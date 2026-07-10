-- =====================================================
-- TAECKER 관리자 / 신고 / 계정 정지 기능 설정
-- 주의: 이 파일은 실제 운영 DB에 이미 적용되어 있던 내용을
--       소급 기록한 것입니다 (마이그레이션 이력 누락 백필).
--       처음부터 새로 세팅하는 프로젝트라면 이 파일을
--       Supabase SQL Editor에서 한 번 실행하면 됩니다.
--       이미 적용된 DB에서 재실행해도 안전하도록
--       idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

-- ---------- 1) profiles: 관리자 / 정지 관련 컬럼 ----------
alter table public.profiles
    add column if not exists is_admin boolean not null default false,
    add column if not exists suspended_until timestamptz,
    add column if not exists suspended_reason text,
    add column if not exists banned boolean not null default false,
    add column if not exists ban_reason text;

-- ---------- 2) 헬퍼 함수 ----------
-- 관리자 여부 확인 (RLS 정책에서 재귀 없이 사용하기 위한 SECURITY DEFINER 함수)
-- 과거에 is_admin()이라는 동일한 기능의 함수가 중복으로 존재했으나 정리됨.
-- 정책에서는 반드시 이 함수(is_admin_user)만 사용할 것.
create or replace function public.is_admin_user()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 현재 로그인한 계정이 정지/영구정지 상태인지 확인
create or replace function public.is_suspended()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select suspended_until > now() from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------- 3) reports 테이블 ----------
create table if not exists public.reports (
    id bigint generated always as identity primary key,
    reporter_id uuid not null references public.profiles(id),
    target_type text not null check (target_type in ('post','comment')),
    target_id bigint not null,
    target_user_id uuid references public.profiles(id),
    reason text not null check (char_length(reason) between 1 and 500),
    status text not null default 'pending' check (status in ('pending','resolved','rejected')),
    resolved_at timestamptz,
    resolved_by uuid references public.profiles(id),
    created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

drop policy if exists reports_insert_own on public.reports;
drop policy if exists reports_select_own on public.reports;
drop policy if exists reports_select_admin on public.reports;
drop policy if exists reports_update_admin on public.reports;

-- 본인 명의로만 신고 접수 가능, 단 정지된 계정은 신고도 불가
-- (posts/comments/likes의 insert 정책과 동일한 규칙 적용)
create policy reports_insert_own
    on public.reports
    for insert
    with check (auth.uid() = reporter_id and not is_suspended());

-- 본인이 접수한 신고는 본인이 조회 가능
create policy reports_select_own
    on public.reports
    for select
    using (auth.uid() = reporter_id);

-- 관리자는 전체 신고 내역 조회 가능
create policy reports_select_admin
    on public.reports
    for select
    using (is_admin_user());

-- 관리자만 신고 상태(처리완료/반려) 변경 가능
create policy reports_update_admin
    on public.reports
    for update
    using (is_admin_user());

-- ---------- 4) profiles: 관리자 정지 처리 권한 ----------
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update
    on public.profiles
    for update
    using (is_admin_user());

-- ---------- 5) posts / comments: 관리자 삭제 권한 ----------
drop policy if exists posts_delete_admin on public.posts;
create policy posts_delete_admin
    on public.posts
    for delete
    using (is_admin_user());

drop policy if exists comments_delete_admin on public.comments;
create policy comments_delete_admin
    on public.comments
    for delete
    using (is_admin_user());

-- ---------- 6) 최초 관리자 계정 지정 ----------
-- 2학년 5반 6번(닉네임 '오케이') 계정에 관리자 권한 부여
-- 이미 부여된 상태라면 아무 효과 없음 (idempotent)
update public.profiles
set is_admin = true
where grade = 2 and class_number = 5 and number = 6;
