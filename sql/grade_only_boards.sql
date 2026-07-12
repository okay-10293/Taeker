-- =====================================================
-- TAECKER 학년별 게시판 (1학년/2학년/3학년)
-- 주의: 이 파일은 실제 운영 DB에 이미 적용되어 있던 내용을
--       소급 기록한 것입니다 (마이그레이션 이력 누락 백필).
--       idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

-- posts.category 값으로 'grade1'/'grade2'/'grade3'를 사용한다.
-- 다른 학년의 게시글/댓글은 프론트에서 숨기는 게 아니라 DB(RLS) 단에서
-- 아예 조회가 차단된다 — 본인 학년이 아니면 API로 직접 조회해도 안 보임.

create or replace function public.can_view_grade_category(p_category text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select
        p_category not in ('grade1','grade2','grade3')
        or is_admin_user()
        or (
            select grade from public.profiles where id = auth.uid()
        ) = case p_category
              when 'grade1' then 1
              when 'grade2' then 2
              when 'grade3' then 3
            end;
$$;

-- 게시글: 학년게시판 글은 같은 학년(또는 관리자)만 조회 가능
drop policy if exists posts_select_all on public.posts;
create policy posts_select_all
    on public.posts
    for select
    using (can_view_grade_category(category));

-- 게시글 작성: 학년게시판에는 본인 학년 카테고리로만 작성 가능
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own
    on public.posts
    for insert
    with check (
        auth.uid() = author_id
        and not is_suspended()
        and can_view_grade_category(category)
    );

-- 댓글: 원글이 학년게시판이면 같은 학년(또는 관리자)만 댓글 조회 가능
drop policy if exists comments_select_all on public.comments;
create policy comments_select_all
    on public.comments
    for select
    using (
        exists (
            select 1 from public.posts p
            where p.id = comments.post_id
              and can_view_grade_category(p.category)
        )
    );
