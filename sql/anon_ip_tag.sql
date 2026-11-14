-- =====================================================
-- 비로그인 글/댓글/달력 일정 닉네임 뒤에 접속 IP 앞 두 자리 표시 (디시인사이드 방식)
--   예) 태성인(211.37)   IPv6 는 앞 두 블록 (2001:db8)
-- ● 요청 헤더(cf-connecting-ip → x-forwarded-for)에서 읽어 서버가 직접 붙이므로 조작 불가
-- ● 관리자 계정으로 쓴 글에는 붙지 않음
-- ● idempotent
-- =====================================================

create or replace function public._ip_tag()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
    h  json;
    ip text;
begin
    begin
        h := current_setting('request.headers', true)::json;
    exception when others then
        return '';
    end;
    if h is null then return ''; end if;
    ip := btrim(coalesce(nullif(h->>'cf-connecting-ip', ''), split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)));
    if ip is null or ip = '' or ip !~ '^[0-9a-fA-F:.]+$' then return ''; end if;
    if position(':' in ip) > 0 then
        return '(' || split_part(ip, ':', 1) || ':' || split_part(ip, ':', 2) || ')';
    end if;
    return '(' || split_part(ip, '.', 1) || '.' || split_part(ip, '.', 2) || ')';
end;
$$;
revoke all on function public._ip_tag() from public, anon, authenticated;

-- create_post / create_comment / create_calendar_event 에서 닉네임 확정 직후:
--   if not v_admin then v_nick := v_nick || public._ip_tag(); end if;
