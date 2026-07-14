-- =====================================================
-- TAECKER 선생님 공지사항 작성 권한
-- 주의: 이 파일은 실제 운영 DB에 이미 적용되어 있던 내용을
--       소급 기록한 것입니다 (마이그레이션 이력 누락 백필).
--       idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

-- 선생님(is_teacher=true)도 공지사항을 작성할 수 있도록 허용.
-- 단, 선생님은 본인이 쓴 전체공개 공지(target_user_id is null)만
-- 작성/수정/삭제 가능하고, 다른 사람이 쓴 공지나 특정 유저 대상
-- 개인 공지(정지 사유 안내 등 관리자 전용 기능)는 건드릴 수 없다.
-- 관리자(is_admin)는 기존처럼 모든 공지에 대해 전체 권한 유지.

create or replace function public.is_teacher()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select coalesce(
        (select is_teacher from public.profiles where id = auth.uid()),
        false
    );
$$;

-- 선생님이 본인이 쓴 공지는 임시저장 상태여도 조회 가능해야 관리 화면에서
-- 보이고 수정할 수 있다 (기존 notices_select_admin은 관리자 전용이라
-- 별도 정책 추가)
drop policy if exists notices_select_own on public.notices;
create policy notices_select_own
    on public.notices
    for select
    using (created_by = auth.uid());

drop policy if exists notices_insert_admin on public.notices;
drop policy if exists notices_insert_admin_or_teacher on public.notices;
create policy notices_insert_admin_or_teacher
    on public.notices
    for insert
    with check (
        is_admin_user()
        or (
            is_teacher()
            and created_by = auth.uid()
            and target_user_id is null
        )
    );

drop policy if exists notices_update_admin on public.notices;
drop policy if exists notices_update_admin_or_teacher on public.notices;
create policy notices_update_admin_or_teacher
    on public.notices
    for update
    using (
        is_admin_user()
        or (is_teacher() and created_by = auth.uid())
    )
    with check (
        is_admin_user()
        or (
            is_teacher()
            and created_by = auth.uid()
            and target_user_id is null
        )
    );

drop policy if exists notices_delete_admin on public.notices;
drop policy if exists notices_delete_admin_or_teacher on public.notices;
create policy notices_delete_admin_or_teacher
    on public.notices
    for delete
    using (
        is_admin_user()
        or (is_teacher() and created_by = auth.uid())
    );
