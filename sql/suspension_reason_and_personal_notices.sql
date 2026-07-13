-- =====================================================
-- TAECKER 정지 사유 + 개인 공지사항
-- 주의: 이 파일은 실제 운영 DB에 이미 적용되어 있던 내용을
--       소급 기록한 것입니다 (마이그레이션 이력 누락 백필).
--       idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

-- 1) 정지/영구정지 사유 저장 컬럼
--    관리자가 정지시킬 때 입력한 사유가 여기 저장되고,
--    정지당한 사람이 로그인 시도 시 이 사유와 기간을 함께 볼 수 있다.
alter table public.profiles
    add column if not exists suspended_reason text;

-- 2) 공지사항: 특정 유저 전용(개인) 공지
--    target_user_id가 null이면 기존처럼 전체 공개 공지,
--    값이 있으면 해당 유저 본인의 알림함에만 노출된다.
alter table public.notices
    add column if not exists target_user_id uuid references public.profiles(id) on delete cascade;

create index if not exists notices_target_user_idx
    on public.notices (target_user_id)
    where target_user_id is not null;

-- 3) 공지 조회 정책 갱신: 전체공개 공지는 누구나, 개인 공지는 본인만
drop policy if exists notices_select_published on public.notices;
create policy notices_select_published
    on public.notices
    for select
    using (
        is_published = true
        and (target_user_id is null or target_user_id = auth.uid())
    );
