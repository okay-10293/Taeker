-- =====================================================
-- TAECKER 게시판 목록 조회 성능 인덱스
-- 게시글 수가 많아져도 카테고리 필터 + 최신순/인기순 정렬 +
-- 페이지네이션 쿼리가 느려지지 않도록 미리 인덱스를 추가한다.
-- (idempotent — 중복 실행해도 안전)
-- =====================================================

create index if not exists idx_posts_category_created_at
    on public.posts (category, created_at desc);

create index if not exists idx_posts_created_at
    on public.posts (created_at desc);

create index if not exists idx_posts_category_view_count
    on public.posts (category, view_count desc);

create index if not exists idx_posts_view_count
    on public.posts (view_count desc);

create index if not exists idx_comments_post_id
    on public.comments (post_id);

create index if not exists idx_likes_post_id
    on public.likes (post_id);
