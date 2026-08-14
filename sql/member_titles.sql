-- =====================================================
-- TAECKER 회원 칭호(커스텀 뱃지) 기능
-- 관리자가 특정 회원에게 칭호를 부여하면, 선생님 뱃지("선생님")와
-- 동일한 방식으로 닉네임 옆에 표시됩니다.
-- inquiries_setup.sql 등과 마찬가지로 idempotent(중복 실행 안전)하게
-- 작성했습니다.
-- =====================================================

-- ---------- 1) profiles: 칭호 컬럼 ----------
alter table public.profiles
    add column if not exists title text;

-- 너무 긴 칭호가 뱃지 레이아웃을 깨뜨리지 않도록 길이 제한 (최대 8자)
do $$
begin

    if not exists (
        select 1
        from pg_constraint
        where conname = 'profiles_title_length_check'
    ) then

        alter table public.profiles
            add constraint profiles_title_length_check
            check (title is null or char_length(title) <= 8);

    end if;

end;
$$;

-- 빈 문자열은 저장하지 않고 null로 취급 (뱃지 미노출)
create or replace function public.normalize_profile_title()
returns trigger
language plpgsql
as $$
begin

    if new.title is not null and btrim(new.title) = '' then
        new.title := null;
    elsif new.title is not null then
        new.title := btrim(new.title);
    end if;

    return new;

end;
$$;

drop trigger if exists profiles_normalize_title_trigger on public.profiles;

create trigger profiles_normalize_title_trigger
    before insert or update of title on public.profiles
    for each row
    execute function public.normalize_profile_title();

-- ---------- 2) 권한 ----------
-- 칭호 수정은 관리자만 가능해야 하므로, 기존 profiles_admin_update
-- 정책(admin_setup.sql)이 이미 모든 컬럼에 대한 관리자 수정 권한을
-- 부여하고 있어 별도 정책 추가가 필요 없습니다.
-- 조회는 nickname/is_teacher와 동일하게 기존 profiles select 정책을 따릅니다.
