-- =====================================================
-- 고정닉(고닉)
--   · register_fixed_nick(닉네임, 비밀번호) 로 닉네임을 등록하면 그 닉네임은 비밀번호를 아는 사람만 쓸 수 있음
--   · 고닉으로 쓴 글/댓글은 IP 대신 '고닉' 뱃지가 붙음 (posts/comments.is_fixed)
--   · 글/댓글 비밀번호 칸에 고닉 비밀번호를 입력하면 인증됨 (오답 5회 → 10분 잠금, secret_fails 재사용)
--   · 오답/잠금은 예외 대신 create_post/create_comment 가 -1 / -2 를 반환 (예외면 실패 횟수 기록이 롤백되기 때문)
--   · 닉네임에 괄호 금지 (IP 표시 '닉네임(211.37)' 위장 방지)
-- idempotent
-- =====================================================

create table if not exists public.fixed_nicks (
    nick_key   text primary key,
    nickname   text not null,
    pw_hash    text not null,
    client_id  text,
    created_at timestamptz not null default now()
);
alter table public.fixed_nicks enable row level security;
revoke all on public.fixed_nicks from anon, authenticated;

alter table public.posts    add column if not exists is_fixed boolean not null default false;
alter table public.comments add column if not exists is_fixed boolean not null default false;
grant select (is_fixed) on public.posts    to anon, authenticated;
grant select (is_fixed) on public.comments to anon, authenticated;

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
    if v ~ '[()（）]' then
        raise exception '닉네임에는 괄호를 쓸 수 없어요.' using errcode = 'P0001';
    end if;
    if not public.is_admin_user() and lower(v) ~ '(관리자|운영자|운영진|admin|태커|taeker)' then
        raise exception '사용할 수 없는 닉네임이에요.' using errcode = 'P0001';
    end if;
    return v;
end;
$$;

-- 'none' | 'ok' | 'wrong' | 'locked'
create or replace function public._check_fixed(p_nick text, p_pw text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_row public.fixed_nicks%rowtype;
    v_tid bigint;
    v_fail public.secret_fails%rowtype;
begin
    select * into v_row from public.fixed_nicks where nick_key = lower(p_nick);
    if not found then return 'none'; end if;

    v_tid := hashtextextended(v_row.nick_key, 0);
    select * into v_fail from public.secret_fails where kind = 'fixednick' and target_id = v_tid;
    if v_fail.locked_until is not null and v_fail.locked_until > now() then return 'locked'; end if;

    if extensions.crypt(coalesce(p_pw, ''), v_row.pw_hash) = v_row.pw_hash then
        delete from public.secret_fails where kind = 'fixednick' and target_id = v_tid;
        return 'ok';
    end if;

    insert into public.secret_fails(kind, target_id, fails) values ('fixednick', v_tid, 1)
    on conflict (kind, target_id) do update
        set fails = case when public.secret_fails.locked_until is not null
                              and public.secret_fails.locked_until <= now()
                         then 1 else public.secret_fails.fails + 1 end,
            locked_until = null;
    update public.secret_fails set fails = 0, locked_until = now() + interval '10 minutes'
    where kind = 'fixednick' and target_id = v_tid and fails >= 5;
    return 'wrong';
end;
$$;
revoke all on function public._check_fixed(text, text) from public, anon, authenticated;

create or replace function public.register_fixed_nick(p_nickname text, p_password text, p_client_id text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_nick text;
begin
    perform public._check_client(p_client_id);
    v_nick := public._check_nick(p_nickname);
    if char_length(v_nick) < 2 then
        raise exception '고정닉은 2자 이상이어야 해요.' using errcode = 'P0001';
    end if;
    if lower(v_nick) in ('태성인', '익명') then
        raise exception '이 닉네임은 고정닉으로 쓸 수 없어요.' using errcode = 'P0001';
    end if;
    if p_password is null or char_length(p_password) < 4 or char_length(p_password) > 30 then
        raise exception '비밀번호는 4~30자로 입력해주세요.' using errcode = 'P0001';
    end if;
    if not public.is_admin_user() and (select count(*) from public.fixed_nicks
         where client_id = p_client_id and created_at > now() - interval '1 day') >= 3 then
        raise exception '하루에 만들 수 있는 고정닉은 3개까지예요.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.fixed_nicks where nick_key = lower(v_nick)) then
        return 'exists';
    end if;
    insert into public.fixed_nicks (nick_key, nickname, pw_hash, client_id)
    values (lower(v_nick), v_nick, extensions.crypt(p_password, extensions.gen_salt('bf')), p_client_id);
    return 'ok';
end;
$$;
grant execute on function public.register_fixed_nick(text, text, text) to anon, authenticated;

-- create_post / create_comment 패치 (닉네임 확정 직후 고닉 확인, 성공 시 is_fixed 표시)
do $$
declare r record; def text; tbl text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname in ('create_post','create_comment')
  loop
    def := pg_get_functiondef(r.oid);
    if position('_check_fixed' in def) > 0 then continue; end if;
    tbl := case when r.proname='create_post' then 'posts' else 'comments' end;
    def := replace(def, E'declare\n', E'declare\n    v_fixed boolean := false;\n    v_fx text;\n');
    def := replace(def, 'if not v_admin then v_nick := v_nick || public._ip_tag(); end if;',
E'if not v_admin then
        v_fx := public._check_fixed(v_nick, p_password);
        if v_fx = ''wrong'' then return -1; end if;
        if v_fx = ''locked'' then return -2; end if;
        v_fixed := (v_fx = ''ok'');
        if not v_fixed then v_nick := v_nick || public._ip_tag(); end if;
    end if;');
    def := replace(def, 'returning id into v_id;',
        'returning id into v_id;' || E'\n    if v_fixed then update public.' || tbl || ' set is_fixed = true where id = v_id; end if;');
    execute def;
  end loop;
end $$;
