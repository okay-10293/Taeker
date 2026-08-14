-- =====================================================
-- TAECKER 학교설정(NEIS 연동) RLS 정책
-- 주의: 이 파일은 실제 운영 DB에 이미 적용되어 있던 내용을
--       소급 기록한 것입니다 (마이그레이션 이력 누락 백필).
--       idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

-- school_config 테이블은 school.html(급식/시간표/학사일정)에서
-- 누구나(로그인 없이도) 조회할 수 있어야 한다.
-- 주의: neis_api_key 컬럼이 이 테이블에 함께 저장되어 있어서,
-- SELECT를 public으로 열면 이 키도 비로그인 상태로 그대로 노출된다.
-- (NEIS Open API 키는 학교 공개 정보 조회용이라 큰 비밀은 아니지만,
--  더 엄격하게 하려면 key 조회를 Edge Function 뒤로 옮기는 것을 고려할 것)
-- SELECT는 public(비로그인 포함) 전체에게 허용하고, UPDATE(등록/수정)만 관리자로 제한한다.

drop policy if exists school_config_select_admin on public.school_config;
drop policy if exists school_config_select_authenticated on public.school_config;
drop policy if exists school_config_select_public on public.school_config;

create policy school_config_select_public
    on public.school_config
    for select
    to public
    using (true);

drop policy if exists school_config_update_admin on public.school_config;
create policy school_config_update_admin
    on public.school_config
    for update
    using (is_admin_user());
