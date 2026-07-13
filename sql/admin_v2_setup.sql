-- =====================================================
-- TAECKER 관리자 패널 v2 - 추가 기능
-- 1) profiles.is_teacher 컬럼 추가
--    (js/auth.js의 ensureProfile()이 이미 이 컬럼에 insert를
--     시도하고 있었는데 실제 DB에는 컬럼이 없어 회원가입 자체가
--     실패하고 있었음 - 이 마이그레이션으로 함께 해결됨)
-- 2) profiles.admin_memo 컬럼 추가 (관리자 전용 메모)
-- 3) reports 테이블 관리자 삭제(DELETE) 정책 추가
-- idempotent(중복 실행 안전)하게 작성됨.
-- =====================================================

-- ---------- 1) profiles: 선생님 여부 ----------
alter table public.profiles
    add column if not exists is_teacher boolean not null default false;

-- ---------- 2) profiles: 관리자 메모 ----------
alter table public.profiles
    add column if not exists admin_memo text;

-- ---------- 3) reports: 관리자 삭제 정책 ----------
drop policy if exists reports_delete_admin on public.reports;
create policy reports_delete_admin
    on public.reports
    for delete
    using (is_admin_user());
