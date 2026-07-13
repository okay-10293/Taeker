-- =====================================================
-- TAECKER 공지사항 -> 게시판 자동 동기화
-- 주의: 이 파일은 실제 운영 DB에 이미 적용되어 있던 내용을
--       소급 기록한 것입니다 (마이그레이션 이력 누락 백필).
--       idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

-- 문제: 관리자가 공지사항을 배포하면 notices 테이블에만 들어가서
-- 알림(벨 아이콘)에만 뜨고, 게시판의 '공지사항' 카테고리(posts.category
-- = 'notice')에는 전혀 올라오지 않았음. notices와 posts가 완전히
-- 별개의 테이블이었기 때문.
--
-- 해결: 전체공개(target_user_id is null)로 배포(is_published=true)된
-- 공지는 posts 테이블에도 category='notice'로 자동 동기화되도록 트리거를
-- 추가한다. 개인 공지(target_user_id 있음)는 동기화하지 않는다 — 개인
-- 알림은 계속 알림함에만 노출.
--   - 공지를 배포하면: posts에 새 글 생성 (댓글/좋아요 등 일반 게시글과 동일)
--   - 배포된 공지의 제목/내용을 수정하면: 연결된 게시글도 같이 갱신
--   - 배포를 취소(임시저장)하거나 개인 공지로 바꾸면: 연결된 게시글 삭제
--   - 공지 자체를 삭제하면: 연결된 게시글도 cascade로 함께 삭제

alter table public.posts
    add column if not exists source_notice_id uuid references public.notices(id) on delete cascade;

create index if not exists posts_source_notice_idx
    on public.posts (source_notice_id)
    where source_notice_id is not null;

create or replace function public.sync_notice_to_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_existing_post_id bigint;
begin

    select id into v_existing_post_id
    from public.posts
    where source_notice_id = new.id;

    if new.is_published = true and new.target_user_id is null then

        if v_existing_post_id is not null then

            update public.posts
            set title = new.title,
                content = new.content,
                updated_at = now()
            where id = v_existing_post_id;

        else

            insert into public.posts(author_id, title, content, category, anonymous, source_notice_id)
            values (new.created_by, new.title, new.content, 'notice', false, new.id);

        end if;

    else

        if v_existing_post_id is not null then

            delete from public.posts where id = v_existing_post_id;

        end if;

    end if;

    return new;

end;
$$;

drop trigger if exists notices_sync_to_posts on public.notices;
create trigger notices_sync_to_posts
    after insert or update on public.notices
    for each row
    execute function public.sync_notice_to_post();

-- 이미 배포되어 있던 기존 전체공개 공지들도 소급 동기화
insert into public.posts(author_id, title, content, category, anonymous, source_notice_id, created_at)
select n.created_by, n.title, n.content, 'notice', false, n.id, coalesce(n.published_at, n.created_at)
from public.notices n
where n.is_published = true
  and n.target_user_id is null
  and not exists (select 1 from public.posts p where p.source_notice_id = n.id);
