-- =====================================================
-- 태커 비로그인(익명) 운영 전환 — 3단계: 기존 회원 정리 (선택, 되돌릴 수 없음)
--
-- ● sql/anonymous_mode.sql 적용 + 새 프론트 배포가 끝난 "후에" 실행할 것
-- ● 관리자(is_admin = true) 계정만 남기고 나머지 회원 계정을 삭제한다.
--   (이메일 등 개인정보가 더 이상 필요 없으므로 지우는 것을 권장)
-- ● 삭제된 회원이 쓴 글/댓글은 FK cascade로 함께 삭제된다.
--   남기고 싶은 글이 있으면 실행 전에 아래 SELECT로 먼저 확인하고 백업할 것.
-- =====================================================

-- 1) 먼저 확인 (실행해도 아무것도 지워지지 않음)
select
    (select count(*) from public.profiles where coalesce(is_admin, false) = false) as members_to_delete,
    (select count(*) from public.posts p
       join public.profiles pr on pr.id = p.author_id
      where coalesce(pr.is_admin, false) = false) as posts_to_delete,
    (select count(*) from public.comments c
       join public.profiles pr on pr.id = c.author_id
      where coalesce(pr.is_admin, false) = false) as comments_to_delete;

-- 2) 실제 삭제 (확인 후 아래 주석을 풀고 실행)
-- delete from auth.users
-- where id in (select id from public.profiles where coalesce(is_admin, false) = false);
