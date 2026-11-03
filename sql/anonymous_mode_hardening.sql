-- =====================================================
-- 태커 비로그인 전환 — 보안 보강
--
-- 1) posts/comments 의 client_id(기기 식별값)와 author_id 가 공개 API로 그대로 조회되던 문제 수정
--    → 이 값을 알면 남의 기기로 추천 취소/도배 제한 소진 등을 할 수 있으므로 공개 컬럼에서 제외
--    (안전한 컬럼만 select 허용. 쓰기는 원래 RPC로만 가능)
-- 2) 더 이상 화면이 없는 '학번 도용 신고' 누구나 INSERT 정책 제거 (스팸 방지)
-- idempotent: 여러 번 실행해도 안전
-- =====================================================

revoke select on public.posts    from anon, authenticated;
revoke select on public.comments from anon, authenticated;

grant select (id, title, content, category, anonymous, image_url, view_count, like_count,
              created_at, updated_at, comment_count, source_notice_id, nickname)
    on public.posts to anon, authenticated;

grant select (id, post_id, content, created_at, nickname)
    on public.comments to anon, authenticated;

drop policy if exists impersonation_reports_insert_anyone on public.impersonation_reports;
