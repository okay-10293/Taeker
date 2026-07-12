-- =====================================================
-- TAECKER 학번 도용 확정 처리 (confirm_impersonation)
-- 주의: 이 파일은 실제 운영 DB에 이미 적용되어 있던 내용을
--       소급 기록한 것입니다 (마이그레이션 이력 누락 백필).
--       idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

-- 학번 도용이 확정되면 도용 계정을 정지(banned=true)만 시키는 게 아니라
-- 완전히 삭제한다. posts/comments/likes는 profiles에 ON DELETE CASCADE로
-- 걸려있어 계정 삭제와 함께 자동으로 정리된다.
-- 이메일은 그대로 banned_emails에 남겨서 같은 이메일로 재가입은 계속 막되,
-- 학년+반+번호(학번)는 완전히 비워지므로 도용당한 학생이 자신의 학번으로
-- 바로 가입할 수 있게 된다.

create or replace function public.confirm_impersonation(p_report_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_report record;
    v_email text;
begin
    if not is_admin_user() then
        raise exception 'ADMIN_REQUIRED';
    end if;

    select * into v_report
    from public.impersonation_reports
    where id = p_report_id;

    if v_report.id is null then
        raise exception 'REPORT_NOT_FOUND';
    end if;

    if v_report.accused_profile_id is not null then

        select email into v_email
        from public.profiles
        where id = v_report.accused_profile_id;

        if v_email is not null then
            insert into public.banned_emails(email, reason, banned_by)
            values (
                lower(v_email),
                '학번 도용 신고 확정 (report #' || p_report_id || ')',
                auth.uid()
            )
            on conflict (email) do nothing;
        end if;

        -- 계정을 완전히 삭제 (profiles/posts/comments/likes는 cascade로 함께 삭제됨)
        delete from auth.users where id = v_report.accused_profile_id;

    end if;

    update public.impersonation_reports
    set status = 'resolved',
        resolved_at = now(),
        resolved_by = auth.uid(),
        accused_profile_id = null
    where id = p_report_id;
end;
$$;
