-- =====================================================
-- TAECKER 공지사항 기능 설정
-- Supabase SQL Editor에서 한 번 실행해주세요.
-- (관리자만 작성/배포 가능, 배포된 공지만 일반 사용자에게 노출)
-- =====================================================

create table if not exists public.notices (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    content text not null,
    is_published boolean not null default false,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    published_at timestamptz
);

create index if not exists notices_published_idx
    on public.notices (published_at desc)
    where is_published = true;

alter table public.notices enable row level security;

-- 기존 정책이 있다면 재실행 가능하도록 정리
drop policy if exists notices_select_published on public.notices;
drop policy if exists notices_select_admin on public.notices;
drop policy if exists notices_insert_admin on public.notices;
drop policy if exists notices_update_admin on public.notices;
drop policy if exists notices_delete_admin on public.notices;

-- 배포된 공지는 누구나(비로그인 포함) 조회 가능
create policy notices_select_published
    on public.notices
    for select
    using (is_published = true);

-- 관리자는 임시저장분까지 전체 조회 가능
create policy notices_select_admin
    on public.notices
    for select
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.is_admin = true
        )
    );

-- 관리자만 작성 가능
create policy notices_insert_admin
    on public.notices
    for insert
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.is_admin = true
        )
    );

-- 관리자만 수정(배포/배포취소 포함) 가능
create policy notices_update_admin
    on public.notices
    for update
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.is_admin = true
        )
    );

-- 관리자만 삭제 가능
create policy notices_delete_admin
    on public.notices
    for delete
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.is_admin = true
        )
    );
