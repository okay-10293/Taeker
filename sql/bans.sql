-- =====================================================
-- 관리자 정지 (시간/일/영구, 계정(고닉)·기기 / 같은 IP)
--   · posts/comments.ip : 작성 시 전체 IP 저장 (비공개 — select 권한 없음, 관리자 RPC로만 사용)
--   · bans(kind: fixed=고닉 계정 | client=기기 | ip) , until null = 영구
--   · create_post / create_comment / create_calendar_event 에서 _check_ban 으로 차단
--   · admin_ban(p_kind 'post'|'comment', p_id, p_scope 'account'|'ip', p_hours null=영구, p_reason)
--   · admin_author_info(p_kind, p_id) / admin_list_bans() / admin_unban(p_id)
-- idempotent
-- =====================================================
alter table public.posts    add column if not exists ip text;
alter table public.comments add column if not exists ip text;
revoke select (ip) on public.posts    from anon, authenticated;
revoke select (ip) on public.comments from anon, authenticated;

create table if not exists public.bans (
    id         bigserial primary key,
    kind       text not null check (kind in ('fixed','client','ip')),
    target     text not null,
    reason     text,
    until      timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists bans_lookup on public.bans(kind, target);
alter table public.bans enable row level security;
revoke all on public.bans from anon, authenticated;

create or replace function public._client_ip()
returns text language plpgsql stable set search_path = public as $$
declare h json; ip text;
begin
    begin h := current_setting('request.headers', true)::json; exception when others then return null; end;
    if h is null then return null; end if;
    ip := btrim(coalesce(nullif(h->>'cf-connecting-ip',''), split_part(coalesce(h->>'x-forwarded-for',''), ',', 1)));
    if ip is null or ip = '' or ip !~ '^[0-9a-fA-F:.]+$' then return null; end if;
    return ip;
end;
$$;
revoke all on function public._client_ip() from public, anon, authenticated;

create or replace function public._ban_msg(p_until timestamptz)
returns text language sql immutable as $$
    select case when p_until is null then '정지된 사용자예요. (영구 정지)'
                else '정지된 사용자예요. ' || to_char(p_until at time zone 'Asia/Seoul', 'MM월 DD일 HH24:MI') || '까지 이용할 수 없어요.' end;
$$;

create or replace function public._check_ban(p_client_id text, p_pw text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ip text := public._client_ip(); v_nick text; v_until timestamptz; v_hit boolean := false;
begin
    if public.is_admin_user() then return; end if;
    if p_pw like 'tk\_%' then
        select s.nick_key into v_nick from public.fixed_sessions s where s.token = p_pw;
    end if;
    select max(coalesce(b.until, 'infinity'::timestamptz)), true into v_until, v_hit
    from public.bans b
    where (b.until is null or b.until > now())
      and ((b.kind = 'client' and b.target = p_client_id)
        or (b.kind = 'ip' and v_ip is not null and b.target = v_ip)
        or (b.kind = 'fixed' and v_nick is not null and b.target = v_nick));
    if v_hit and v_until is not null then
        raise exception '%', public._ban_msg(case when v_until = 'infinity' then null else v_until end) using errcode = 'P0001';
    end if;
end;
$$;
revoke all on function public._check_ban(text, text) from public, anon, authenticated;

-- create_* 패치
do $$
declare r record; def text; tbl text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname in ('create_post','create_comment','create_calendar_event')
  loop
    def := pg_get_functiondef(r.oid);
    if position('_check_ban' in def) > 0 then continue; end if;
    def := replace(def, 'perform public._check_client(p_client_id);',
                   E'perform public._check_client(p_client_id);\n    perform public._check_ban(p_client_id, p_password);');
    if r.proname in ('create_post','create_comment') then
      tbl := case when r.proname='create_post' then 'posts' else 'comments' end;
      def := replace(def, 'returning id into v_id;',
          'returning id into v_id;' || E'\n    update public.' || tbl || ' set ip = public._client_ip() where id = v_id;');
    end if;
    execute def;
  end loop;
end $$;

-- 관리자: 작성자 정보
create or replace function public.admin_author_info(p_kind text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_nick text; v_fixed boolean; v_cid text; v_ip text; v_bans jsonb;
begin
    if not public.is_admin_user() then raise exception '권한이 없어요.' using errcode='P0001'; end if;
    if p_kind = 'post' then select nickname, is_fixed, client_id, ip into v_nick, v_fixed, v_cid, v_ip from public.posts where id = p_id;
    else select nickname, is_fixed, client_id, ip into v_nick, v_fixed, v_cid, v_ip from public.comments where id = p_id; end if;
    if not found then raise exception '글을 찾을 수 없어요.' using errcode='P0001'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'kind',b.kind,'until',b.until,'reason',b.reason)), '[]'::jsonb) into v_bans
    from public.bans b
    where (b.until is null or b.until > now())
      and ((b.kind='client' and b.target=v_cid) or (b.kind='ip' and b.target=v_ip) or (b.kind='fixed' and b.target=lower(v_nick) and v_fixed));
    return jsonb_build_object('nickname', v_nick, 'is_fixed', coalesce(v_fixed,false), 'has_ip', v_ip is not null, 'bans', v_bans);
end;
$$;
grant execute on function public.admin_author_info(text, bigint) to authenticated;

create or replace function public.admin_ban(p_kind text, p_id bigint, p_scope text, p_hours int, p_reason text)
returns text language plpgsql security definer set search_path = public as $$
declare v_nick text; v_fixed boolean; v_cid text; v_ip text; v_k text; v_t text; v_until timestamptz;
begin
    if not public.is_admin_user() then raise exception '권한이 없어요.' using errcode='P0001'; end if;
    if p_kind = 'post' then select nickname, is_fixed, client_id, ip into v_nick, v_fixed, v_cid, v_ip from public.posts where id = p_id;
    else select nickname, is_fixed, client_id, ip into v_nick, v_fixed, v_cid, v_ip from public.comments where id = p_id; end if;
    if not found then raise exception '글을 찾을 수 없어요.' using errcode='P0001'; end if;
    if p_scope = 'ip' then
        if v_ip is null then raise exception '이 글에는 IP 기록이 없어요.' using errcode='P0001'; end if;
        v_k := 'ip'; v_t := v_ip;
    elsif v_fixed then v_k := 'fixed'; v_t := lower(v_nick);
    else
        if v_cid is null then raise exception '기기 정보가 없는 글이에요.' using errcode='P0001'; end if;
        v_k := 'client'; v_t := v_cid;
    end if;
    v_until := case when p_hours is null then null else now() + make_interval(hours => p_hours) end;
    insert into public.bans(kind, target, reason, until) values (v_k, v_t, nullif(btrim(p_reason),''), v_until);
    return 'ok';
end;
$$;
grant execute on function public.admin_ban(text, bigint, text, int, text) to authenticated;

create or replace function public.admin_list_bans()
returns table(id bigint, kind text, label text, reason text, until timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
    if not public.is_admin_user() then raise exception '권한이 없어요.' using errcode='P0001'; end if;
    return query
    select b.id, b.kind,
           case b.kind when 'fixed' then '고닉 ' || coalesce((select f.nickname from public.fixed_nicks f where f.nick_key = b.target), b.target)
                       when 'ip' then 'IP ' || regexp_replace(b.target, '(\.[0-9]+)$', '.*')
                       else '기기 ' || left(b.target, 6) end,
           b.reason, b.until, b.created_at
    from public.bans b where b.until is null or b.until > now() order by b.created_at desc;
end;
$$;
grant execute on function public.admin_list_bans() to authenticated;

create or replace function public.admin_unban(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not public.is_admin_user() then raise exception '권한이 없어요.' using errcode='P0001'; end if;
    delete from public.bans where id = p_id;
end;
$$;
grant execute on function public.admin_unban(bigint) to authenticated;
