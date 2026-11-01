-- =====================================================
-- 태커 비로그인(익명) 운영 전환 — 1단계: 스키마/RLS/RPC
--
-- 디시인사이드 방식: 글/댓글마다 닉네임 + 비밀번호를 입력하고,
-- 수정/삭제는 그 비밀번호로만 가능. 로그인은 관리자만 사용.
--
-- ● 이 파일은 "추가/교체" 위주라서 먼저 실행해도 데이터는 지워지지 않음
--   (단, 기존 로그인 방식 정책은 제거되므로 새 프론트와 같이 배포할 것)
-- ● 기존 회원/글 정리(삭제)는 sql/anonymous_mode_cleanup.sql 에서 따로 실행
-- ● idempotent: 여러 번 실행해도 안전
-- =====================================================

-- ---------- 1) 컬럼 추가 ----------
alter table public.posts
    add column if not exists nickname  text,
    add column if not exists client_id text;

alter table public.comments
    add column if not exists nickname  text,
    add column if not exists client_id text;

alter table public.likes
    add column if not exists client_id text;
alter table public.likes alter column user_id drop not null;

create unique index if not exists likes_post_client_unique
    on public.likes (post_id, client_id) where client_id is not null;

-- 기존 글/댓글의 닉네임을 프로필에서 복사 (관리자 공지 등)
update public.posts p
set nickname = coalesce((select nickname from public.profiles where id = p.author_id), '관리자')
where nickname is null;

update public.comments c
set nickname = coalesce((select nickname from public.profiles where id = c.author_id), '익명')
where nickname is null;

alter table public.posts    alter column nickname set default '익명';
alter table public.comments alter column nickname set default '익명';

-- 신고/문의: 로그인 계정 없이도 접수 가능하도록
alter table public.reports alter column reporter_id drop not null;
alter table public.reports add column if not exists reporter_client_id text;
create unique index if not exists reports_target_client_unique
    on public.reports (target_type, target_id, reporter_client_id)
    where reporter_client_id is not null;

alter table public.inquiries alter column user_id drop not null;
alter table public.inquiries
    add column if not exists nickname     text,
    add column if not exists contact      text,
    add column if not exists receipt_code text,
    add column if not exists client_id    text;
create unique index if not exists inquiries_receipt_code_unique
    on public.inquiries (receipt_code) where receipt_code is not null;

drop trigger if exists inquiries_daily_limit_trigger on public.inquiries;

-- ---------- 2) 비밀번호 해시 보관 (공개 조회 불가) ----------
-- RLS를 켜고 정책을 하나도 만들지 않으면 anon/authenticated는 읽기/쓰기 모두 불가.
-- 오직 아래 SECURITY DEFINER 함수들만 접근한다.
create table if not exists public.post_secrets (
    post_id bigint primary key references public.posts(id) on delete cascade,
    pw_hash text not null
);
create table if not exists public.comment_secrets (
    comment_id bigint primary key references public.comments(id) on delete cascade,
    pw_hash text not null
);
-- 비밀번호 오답 횟수 (무차별 대입 방지)
create table if not exists public.secret_fails (
    kind text not null,
    target_id bigint not null,
    fails integer not null default 0,
    locked_until timestamptz,
    primary key (kind, target_id)
);
alter table public.post_secrets    enable row level security;
alter table public.comment_secrets enable row level security;
alter table public.secret_fails    enable row level security;
revoke all on public.post_secrets, public.comment_secrets, public.secret_fails from anon, authenticated;

-- ---------- 3) 헬퍼 ----------
create or replace function public._clean_nick(p text)
returns text language sql immutable as
$$ select btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')) $$;

-- 관리자 사칭 닉네임 차단 (관리자 본인은 허용)
create or replace function public._check_nick(p text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v text := public._clean_nick(p);
begin
    if char_length(v) < 1 or char_length(v) > 12 then
        raise exception '닉네임은 1~12자로 입력해주세요.' using errcode = 'P0001';
    end if;
    if not public.is_admin_user() and lower(v) ~ '(관리자|운영자|운영진|admin|태커|taeker)' then
        raise exception '사용할 수 없는 닉네임이에요.' using errcode = 'P0001';
    end if;
    return v;
end;
$$;

create or replace function public._check_client(p text)
returns void language plpgsql immutable as
$$
begin
    if p is null or char_length(p) < 8 or char_length(p) > 64 then
        raise exception '잠시 후 다시 시도해주세요. (기기 식별 오류)' using errcode = 'P0001';
    end if;
end;
$$;

-- 비밀번호 검증. 반환: 'ok' | 'wrong' | 'locked' | 'notfound'
-- (오답 횟수를 기록해야 하므로 예외를 던지지 않고 문자열로 돌려준다.
--  예외를 던지면 트랜잭션이 롤백되어 오답 기록이 사라진다.)
create or replace function public._verify_secret(p_kind text, p_id bigint, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_hash text;
    v_fail public.secret_fails%rowtype;
begin
    if p_kind = 'post' then
        select pw_hash into v_hash from public.post_secrets where post_id = p_id;
    else
        select pw_hash into v_hash from public.comment_secrets where comment_id = p_id;
    end if;

    if v_hash is null then return 'notfound'; end if;

    select * into v_fail from public.secret_fails where kind = p_kind and target_id = p_id;
    if v_fail.locked_until is not null and v_fail.locked_until > now() then
        return 'locked';
    end if;

    if extensions.crypt(coalesce(p_password, ''), v_hash) = v_hash then
        delete from public.secret_fails where kind = p_kind and target_id = p_id;
        return 'ok';
    end if;

    insert into public.secret_fails(kind, target_id, fails)
    values (p_kind, p_id, 1)
    on conflict (kind, target_id) do update
        set fails = case when public.secret_fails.locked_until is not null
                              and public.secret_fails.locked_until <= now()
                         then 1 else public.secret_fails.fails + 1 end,
            locked_until = null;

    update public.secret_fails
    set fails = 0, locked_until = now() + interval '10 minutes'
    where kind = p_kind and target_id = p_id and fails >= 5;

    return 'wrong';
end;
$$;

-- ---------- 4) 글 ----------
create or replace function public.create_post(
    p_nickname text, p_password text, p_title text, p_content text,
    p_category text, p_client_id text
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_nick  text;
    v_admin boolean := public.is_admin_user();
    v_id    bigint;
begin
    perform public._check_client(p_client_id);
    v_nick := public._check_nick(p_nickname);

    if p_password is null or char_length(p_password) < 4 or char_length(p_password) > 30 then
        raise exception '비밀번호는 4~30자로 입력해주세요.' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(p_title, ''))) not between 1 and 100 then
        raise exception '제목은 1~100자로 입력해주세요.' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(p_content, ''))) not between 1 and 4000 then
        raise exception '내용은 1~4000자로 입력해주세요.' using errcode = 'P0001';
    end if;
    if p_category not in ('free', 'question', 'info', 'grade1', 'grade2', 'grade3')
       and not (v_admin and p_category = 'notice') then
        raise exception '올바르지 않은 게시판이에요.' using errcode = 'P0001';
    end if;

    if not v_admin and exists (
        select 1 from public.posts
        where client_id = p_client_id and created_at > now() - interval '20 seconds'
    ) then
        raise exception '글은 20초에 한 번만 쓸 수 있어요. 잠시 후 다시 시도해주세요.' using errcode = 'P0001';
    end if;

    insert into public.posts (title, content, category, nickname, client_id, author_id)
    values (btrim(p_title), btrim(p_content), p_category, v_nick, p_client_id,
            case when v_admin then auth.uid() end)
    returning id into v_id;

    insert into public.post_secrets (post_id, pw_hash)
    values (v_id, extensions.crypt(p_password, extensions.gen_salt('bf')));

    return v_id;
end;
$$;

create or replace function public.update_post(
    p_id bigint, p_password text, p_title text, p_content text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_res text;
begin
    if char_length(btrim(coalesce(p_title, ''))) not between 1 and 100 then
        raise exception '제목은 1~100자로 입력해주세요.' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(p_content, ''))) not between 1 and 4000 then
        raise exception '내용은 1~4000자로 입력해주세요.' using errcode = 'P0001';
    end if;

    v_res := public._verify_secret('post', p_id, p_password);
    if v_res = 'ok' or (public.is_admin_user() and exists (select 1 from public.posts where id = p_id)) then
        update public.posts
        set title = btrim(p_title), content = btrim(p_content), updated_at = now()
        where id = p_id and source_notice_id is null;
        return 'ok';
    end if;
    return v_res;
end;
$$;

create or replace function public.delete_post(p_id bigint, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_res text;
begin
    v_res := public._verify_secret('post', p_id, p_password);
    if v_res = 'ok' or (public.is_admin_user() and exists (select 1 from public.posts where id = p_id)) then
        delete from public.posts where id = p_id and source_notice_id is null;
        return 'ok';
    end if;
    return v_res;
end;
$$;

-- ---------- 5) 댓글 ----------
create or replace function public.create_comment(
    p_post_id bigint, p_nickname text, p_password text, p_content text, p_client_id text
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_nick  text;
    v_admin boolean := public.is_admin_user();
    v_id    bigint;
begin
    perform public._check_client(p_client_id);
    v_nick := public._check_nick(p_nickname);

    if p_password is null or char_length(p_password) < 4 or char_length(p_password) > 30 then
        raise exception '비밀번호는 4~30자로 입력해주세요.' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(p_content, ''))) not between 1 and 500 then
        raise exception '댓글은 1~500자로 입력해주세요.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.posts where id = p_post_id) then
        raise exception '존재하지 않는 글이에요.' using errcode = 'P0001';
    end if;

    if not v_admin and exists (
        select 1 from public.comments
        where client_id = p_client_id and created_at > now() - interval '5 seconds'
    ) then
        raise exception '댓글은 5초에 한 번만 쓸 수 있어요.' using errcode = 'P0001';
    end if;

    insert into public.comments (post_id, content, nickname, client_id, author_id)
    values (p_post_id, btrim(p_content), v_nick, p_client_id, case when v_admin then auth.uid() end)
    returning id into v_id;

    insert into public.comment_secrets (comment_id, pw_hash)
    values (v_id, extensions.crypt(p_password, extensions.gen_salt('bf')));

    return v_id;
end;
$$;

create or replace function public.delete_comment(p_id bigint, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_res text;
begin
    v_res := public._verify_secret('comment', p_id, p_password);
    if v_res = 'ok' or (public.is_admin_user() and exists (select 1 from public.comments where id = p_id)) then
        delete from public.comments where id = p_id;
        return 'ok';
    end if;
    return v_res;
end;
$$;

-- ---------- 6) 추천 (기기당 1회) ----------
create or replace function public.toggle_like(p_post_id bigint, p_client_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_liked boolean;
    v_count integer;
begin
    perform public._check_client(p_client_id);
    if not exists (select 1 from public.posts where id = p_post_id) then
        raise exception '존재하지 않는 글이에요.' using errcode = 'P0001';
    end if;

    if exists (select 1 from public.likes where post_id = p_post_id and client_id = p_client_id) then
        delete from public.likes where post_id = p_post_id and client_id = p_client_id;
        v_liked := false;
    else
        insert into public.likes (post_id, client_id) values (p_post_id, p_client_id);
        v_liked := true;
    end if;

    select like_count into v_count from public.posts where id = p_post_id;
    return jsonb_build_object('liked', v_liked, 'like_count', coalesce(v_count, 0));
end;
$$;

create or replace function public.has_liked(p_post_id bigint, p_client_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.likes where post_id = p_post_id and client_id = p_client_id);
$$;

-- ---------- 7) 신고 ----------
create or replace function public.submit_report(
    p_target_type text, p_target_id bigint, p_reason text, p_client_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public._check_client(p_client_id);
    if p_target_type not in ('post', 'comment') then
        raise exception '올바르지 않은 신고 대상이에요.' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
        raise exception '신고 사유를 1~500자로 입력해주세요.' using errcode = 'P0001';
    end if;
    if (p_target_type = 'post'    and not exists (select 1 from public.posts    where id = p_target_id))
    or (p_target_type = 'comment' and not exists (select 1 from public.comments where id = p_target_id)) then
        raise exception '이미 삭제된 글이에요.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.reports
        where reporter_client_id = p_client_id and created_at > now() - interval '1 hour') >= 10 then
        raise exception '신고를 너무 많이 했어요. 잠시 후 다시 시도해주세요.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.reports
               where target_type = p_target_type and target_id = p_target_id
                 and reporter_client_id = p_client_id) then
        raise exception '이미 신고한 글이에요.' using errcode = 'P0001';
    end if;

    insert into public.reports (reporter_id, reporter_client_id, target_type, target_id, reason)
    values (null, p_client_id, p_target_type, p_target_id, btrim(p_reason));
end;
$$;

-- ---------- 8) 문의 (접수번호로 답변 조회) ----------
create or replace function public.submit_inquiry(
    p_nickname text, p_contact text, p_content text, p_client_id text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_code text;
begin
    perform public._check_client(p_client_id);
    if char_length(btrim(coalesce(p_content, ''))) not between 1 and 2000 then
        raise exception '문의 내용을 1~2000자로 입력해주세요.' using errcode = 'P0001';
    end if;
    if char_length(coalesce(p_nickname, '')) > 20 or char_length(coalesce(p_contact, '')) > 100 then
        raise exception '이름/연락처가 너무 길어요.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.inquiries
        where client_id = p_client_id and created_at > now() - interval '1 day') >= 3 then
        raise exception '하루에 문의는 최대 3건까지 등록할 수 있어요.' using errcode = 'P0001';
    end if;

    loop
        v_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
        exit when not exists (select 1 from public.inquiries where receipt_code = v_code);
    end loop;

    insert into public.inquiries (user_id, nickname, contact, content, receipt_code, client_id)
    values (null, nullif(btrim(p_nickname), ''), nullif(btrim(p_contact), ''), btrim(p_content), v_code, p_client_id);

    return v_code;
end;
$$;

create or replace function public.lookup_inquiry(p_code text)
returns table (content text, status text, admin_reply text, created_at timestamptz, replied_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
    select i.content, i.status, i.admin_reply, i.created_at, i.replied_at
    from public.inquiries i
    where i.receipt_code = upper(btrim(p_code));
$$;

-- ---------- 9) 공지 → 게시글 동기화: 닉네임 '관리자' ----------
create or replace function public.sync_notice_to_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_existing_post_id bigint;
begin
    select id into v_existing_post_id from public.posts where source_notice_id = new.id;

    if new.is_published = true and new.target_user_id is null then
        if v_existing_post_id is not null then
            update public.posts
            set title = new.title, content = new.content, updated_at = now()
            where id = v_existing_post_id;
        else
            insert into public.posts (author_id, title, content, category, anonymous, source_notice_id, nickname)
            values (new.created_by, new.title, new.content, 'notice', false, new.id, '관리자');
        end if;
    else
        if v_existing_post_id is not null then
            delete from public.posts where id = v_existing_post_id;
        end if;
    end if;
    return new;
end;
$$;

-- ---------- 10) 급식/시간표/학사일정 프록시: 로그인 요구 제거 ----------
-- 파라미터 키 화이트리스트 추가 (비로그인 공개이므로 URL 주입 방지)
create or replace function public.neis_get(p_endpoint text, p_params jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
    v_config record;
    v_url text;
    v_response extensions.http_response;
    v_qs text := '';
    v_key text;
    v_val text;
    v_allowed_endpoints text[] := array['mealServiceDietInfo','hisTimetable','SchoolSchedule'];
begin
    if not (p_endpoint = any(v_allowed_endpoints)) then
        raise exception 'ENDPOINT_NOT_ALLOWED';
    end if;

    select neis_api_key, atpt_ofcdc_sc_code, sd_schul_code
    into v_config
    from public.school_config
    where id = 1;

    if v_config.neis_api_key is null or v_config.atpt_ofcdc_sc_code is null or v_config.sd_schul_code is null then
        raise exception 'NOT_CONFIGURED';
    end if;

    v_qs := 'KEY=' || extensions.urlencode(v_config.neis_api_key)
        || '&Type=json&pIndex=1&pSize=100'
        || '&ATPT_OFCDC_SC_CODE=' || extensions.urlencode(v_config.atpt_ofcdc_sc_code)
        || '&SD_SCHUL_CODE=' || extensions.urlencode(v_config.sd_schul_code);

    for v_key, v_val in select * from jsonb_each_text(p_params)
    loop
        if v_key !~ '^[A-Za-z_]{1,40}$' then
            raise exception 'INVALID_PARAM';
        end if;
        if upper(v_key) in ('KEY','TYPE','ATPT_OFCDC_SC_CODE','SD_SCHUL_CODE') then
            continue;
        end if;
        v_qs := v_qs || '&' || v_key || '=' || extensions.urlencode(v_val);
    end loop;

    v_url := 'https://open.neis.go.kr/hub/' || p_endpoint || '?' || v_qs;

    select * into v_response from extensions.http_get(v_url);

    if v_response.status <> 200 then
        raise exception 'NEIS_HTTP_%', v_response.status;
    end if;

    return v_response.content::jsonb;
end;
$$;

-- ---------- 11) RLS 정책 교체 ----------
-- 글/댓글: 누구나 읽기, 쓰기는 RPC로만 (관리자 삭제 정책은 유지)
drop policy if exists posts_select_all  on public.posts;
drop policy if exists posts_insert_own  on public.posts;
drop policy if exists posts_delete_own  on public.posts;
create policy posts_select_all on public.posts for select using (true);

drop policy if exists comments_select_all on public.comments;
drop policy if exists comments_insert_own on public.comments;
drop policy if exists comments_delete_own on public.comments;
create policy comments_select_all on public.comments for select using (true);

-- 추천: 기기 식별값(client_id)이 노출되지 않도록 관리자만 직접 조회
drop policy if exists likes_select_all on public.likes;
drop policy if exists likes_insert_own on public.likes;
drop policy if exists likes_delete_own on public.likes;
drop policy if exists likes_select_admin on public.likes;
create policy likes_select_admin on public.likes for select using (is_admin_user());

-- 신고/문의: 접수는 RPC, 조회/처리는 관리자만
drop policy if exists reports_insert_own  on public.reports;
drop policy if exists reports_select_own  on public.reports;
drop policy if exists inquiries_insert_own on public.inquiries;
drop policy if exists inquiries_select_own on public.inquiries;
drop policy if exists inquiries_delete_admin on public.inquiries;
create policy inquiries_delete_admin on public.inquiries for delete using (is_admin_user());

-- 공지: 전체 공개 공지만 누구나 조회 (개인 공지 개념 폐지)
drop policy if exists notices_select_published on public.notices;
create policy notices_select_published on public.notices
    for select using (is_published = true and target_user_id is null);

-- 프로필: 이메일 등이 공개되지 않도록 본인 행만 조회 (관리자 로그인 확인용)
drop policy if exists profiles_select_all   on public.profiles;
drop policy if exists profiles_insert_own   on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);

-- 학교 설정: NEIS 인증키는 neis_get()(서버 측 프록시)만 사용하므로 공개 조회 불필요 → 관리자만
drop policy if exists school_config_select_public on public.school_config;
drop policy if exists school_config_select_admin  on public.school_config;
create policy school_config_select_admin on public.school_config for select using (is_admin_user());

-- ---------- 12) 함수 실행 권한 ----------
revoke execute on function public._verify_secret(text, bigint, text) from public, anon, authenticated;
revoke execute on function public._check_nick(text)   from public, anon, authenticated;
grant execute on function
    public.create_post(text, text, text, text, text, text),
    public.update_post(bigint, text, text, text),
    public.delete_post(bigint, text),
    public.create_comment(bigint, text, text, text, text),
    public.delete_comment(bigint, text),
    public.toggle_like(bigint, text),
    public.has_liked(bigint, text),
    public.submit_report(text, bigint, text, text),
    public.submit_inquiry(text, text, text, text),
    public.lookup_inquiry(text),
    public.increment_view_count(bigint),
    public.is_school_configured(),
    public.neis_get(text, jsonb)
to anon, authenticated;
