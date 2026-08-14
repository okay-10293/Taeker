-- =====================================================
-- TAECKER 관리자 - 회원 계정 완전 삭제 (admin_delete_member)
-- =====================================================
-- 회원 목록에서는 지금까지 "정지"만 가능했는데, 계정 자체를
-- 완전히 삭제하는 기능이 없었다. confirm_impersonation()과
-- 같은 방식으로 auth.users를 지워서 profiles/posts/comments/
-- likes가 cascade로 함께 정리되도록 한다.
--
-- 도용 확정(confirm_impersonation)과 달리 이 함수는 banned_emails에
-- 이메일을 추가하지 않는다 — 도용이 아니라 일반적인 계정 삭제이므로
-- 같은 이메일로 재가입이 가능해야 한다.
--
-- 관리자가 실수로 자기 자신이나 다른 관리자를 삭제하는 사고를
-- 막기 위해 대상이 관리자면 삭제를 거부한다.

create or replace function public.admin_delete_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_is_admin boolean;
begin

    if not is_admin_user() then
        raise exception 'ADMIN_REQUIRED';
    end if;

    if p_user_id is null then
        raise exception 'USER_ID_REQUIRED';
    end if;

    if p_user_id = auth.uid() then
        raise exception 'CANNOT_DELETE_SELF';
    end if;

    select is_admin into v_is_admin
    from public.profiles
    where id = p_user_id;

    if v_is_admin then
        raise exception 'CANNOT_DELETE_ADMIN';
    end if;

    delete from auth.users where id = p_user_id;

end;
$$;
