-- =====================================================
-- TAECKER 학교설정(NEIS 연동) RLS 정책
-- 주의: 이 파일은 실제 운영 DB에 이미 적용되어 있던 내용을
--       소급 기록한 것입니다 (마이그레이션 이력 누락 백필).
--       idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

-- school_config 테이블은 school.html(급식/시간표/학사일정)에서
-- 로그인한 모든 학생이 조회할 수 있어야 한다.
-- school.html 자체가 이미 로그인한 유저에게만 열려 있으므로(schoolLoginRequired),
-- SELECT는 인증된 사용자 전체에게 허용하고, UPDATE(등록/수정)만 관리자로 제한한다.

drop policy if exists school_config_select_admin on public.school_config;
drop policy if exists school_config_select_authenticated on public.school_config;

create policy school_config_select_authenticated
    on public.school_config
    for select
    to authenticated
    using (true);

drop policy if exists school_config_update_admin on public.school_config;
create policy school_config_update_admin
    on public.school_config
    for update
    using (is_admin_user());
