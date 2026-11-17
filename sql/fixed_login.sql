-- =====================================================
-- 고닉 로그인 (fixed_nick.sql 대체/개편)
--   · 고닉 = 닉네임+비밀번호로 "로그인"한 사람. 글/댓글 쓸 때 닉네임 고정, 비밀번호 불필요
--   · 로그인하면 세션 토큰('tk_...')을 받고, 글/댓글 작성·수정·삭제는 이 토큰을 password 자리에 실어 보냄
--   · 비밀번호 칸에 고닉 비밀번호를 직접 입력하는 예전 방식은 폐지 (_check_fixed 는 토큰만 인정)
--   · 로그인 오답 5회 → 10분 잠금 (secret_fails 'fixednick')
-- idempotent
-- =====================================================
create table if not exists public.fixed_sessions (
    token      text primary key,
    nick_key   text not null references public.fixed_nicks(nick_key) on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.fixed_sessions enable row level security;
revoke all on public.fixed_sessions from anon, authenticated;

-- 예전 _check_fixed(비밀번호 검증+잠금) → 로그인 전용으로 이름 변경
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='_check_fixed')
     and not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='_verify_fixed_pw') then
    alter function public._check_fixed(text, text) rename to _verify_fixed_pw;
  end if;
end $$;

-- 토큰만 인정: 'none'(고닉 아님) | 'ok' | 'wrong'
create or replace function public._check_fixed(p_nick text, p_pw text)
returns text language plpgsql security definer set search_path = public as $$
declare v_key text := lower(p_nick);
begin
    if not exists (select 1 from public.fixed_nicks where nick_key = v_key) then return 'none'; end if;
    if p_pw like 'tk\_%' and exists (
        select 1 from public.fixed_sessions
        where token = p_pw and nick_key = v_key and created_at > now() - interval '30 days'
    ) then return 'ok'; end if;
    return 'wrong';
end;
$$;
revoke all on function public._check_fixed(text, text) from public, anon, authenticated;

-- 로그인 → {status:'ok'|'wrong'|'locked'|'none', nickname, token}
create or replace function public.fixed_login(p_nickname text, p_password text, p_client_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_st text; v_tok text; v_nick text;
begin
    perform public._check_client(p_client_id);
    v_st := public._verify_fixed_pw(btrim(coalesce(p_nickname,'')), p_password);
    if v_st <> 'ok' then return jsonb_build_object('status', v_st); end if;
    select nickname into v_nick from public.fixed_nicks where nick_key = lower(btrim(p_nickname));
    v_tok := 'tk_' || left(replace(gen_random_uuid()::text, '-', ''), 24);
    insert into public.fixed_sessions(token, nick_key) values (v_tok, lower(btrim(p_nickname)));
    delete from public.fixed_sessions where created_at < now() - interval '30 days';
    return jsonb_build_object('status','ok','nickname',v_nick,'token',v_tok);
end;
$$;
grant execute on function public.fixed_login(text, text, text) to anon, authenticated;

create or replace function public.fixed_logout(p_token text)
returns void language sql security definer set search_path = public as $$
    delete from public.fixed_sessions where token = p_token;
$$;
grant execute on function public.fixed_logout(text) to anon, authenticated;

-- 토큰이 아직 유효한지 확인 (페이지 로드 시)
create or replace function public.fixed_session_ok(p_token text)
returns text language sql stable security definer set search_path = public as $$
    select f.nickname from public.fixed_sessions s join public.fixed_nicks f on f.nick_key = s.nick_key
    where s.token = p_token and s.created_at > now() - interval '30 days';
$$;
grant execute on function public.fixed_session_ok(text) to anon, authenticated;

-- 글/댓글 수정·삭제·첨부: 토큰이면 그 글/댓글이 해당 고닉 것인지 확인
do $$
declare def text; oid_ oid;
begin
  select p.oid into oid_ from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='_verify_secret';
  def := pg_get_functiondef(oid_);
  if position('fixed_sessions' in def) = 0 then
    def := replace(def, E'begin\n    if p_kind = ''post'' then',
E'begin
    if p_password like ''tk\\_%'' then
        if exists (
            select 1 from public.fixed_sessions s
            where s.token = p_password and s.created_at > now() - interval ''30 days''
              and ((p_kind = ''post''    and exists (select 1 from public.posts    x where x.id = p_id and x.is_fixed and lower(x.nickname) = s.nick_key))
                or (p_kind <> ''post'' and exists (select 1 from public.comments x where x.id = p_id and x.is_fixed and lower(x.nickname) = s.nick_key)))
        ) then return ''ok''; end if;
        return ''wrong'';
    end if;
    if p_kind = ''post'' then');
    execute def;
  end if;
end $$;
