-- =====================================================
-- TAECKER 문의하기 - 1일 3건 제한
-- inquiries_setup.sql 적용 이후에 실행하세요.
-- 클라이언트(js/inquiry.js)에서도 동일하게 안내/차단하지만,
-- 우회 등록을 막기 위해 DB 레벨(트리거)에서도 강제합니다.
-- idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

create or replace function public.enforce_inquiry_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    today_count integer;
begin

    select count(*)
    into today_count
    from public.inquiries
    where user_id = new.user_id
      and (created_at at time zone 'Asia/Seoul')::date
          = (now() at time zone 'Asia/Seoul')::date;

    if today_count >= 3 then
        raise exception '하루에 문의는 최대 3건까지 등록할 수 있습니다.'
            using errcode = 'P0001';
    end if;

    return new;

end;
$$;

drop trigger if exists inquiries_daily_limit_trigger on public.inquiries;

create trigger inquiries_daily_limit_trigger
    before insert on public.inquiries
    for each row
    execute function public.enforce_inquiry_daily_limit();
