-- 관리자가 쓴 글/댓글에 '관리자' 표시를 달기 위한 플래그 (author_id 는 공개하지 않으므로 별도 boolean 컬럼)
alter table public.posts    add column if not exists by_admin boolean not null default false;
alter table public.comments add column if not exists by_admin boolean not null default false;
update public.posts    set by_admin = true where author_id in (select id from public.profiles where is_admin = true);
update public.comments set by_admin = true where author_id in (select id from public.profiles where is_admin = true);
grant select (by_admin) on public.posts    to anon, authenticated;
grant select (by_admin) on public.comments to anon, authenticated;
-- create_post / create_comment: insert 직후 `if v_admin then update … set by_admin = true where id = v_id; end if;`
--   (운영 DB 에는 마이그레이션 admin_badge_flag 로 이미 적용됨)
