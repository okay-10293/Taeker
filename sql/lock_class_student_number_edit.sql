-- =====================================================
-- TAECKER 반/번호 본인 수정 잠금
-- 주의: 이 파일은 실제 운영 DB에 이미 적용되어 있던 내용을
--       소급 기록한 것입니다 (마이그레이션 이력 누락 백필).
--       idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

-- 학생 본인은 가입 시 등록한 반(class_number)/번호(student_number)를
-- 마이페이지에서 수정할 수 없도록 DB 레벨에서 강제.
-- 프론트 UI만 막으면 API를 직접 호출해서 우회할 수 있고, 학번 중복 체크
-- (profiles_grade_class_student_key)도 의미가 없어지므로 trigger로 방어.
-- 관리자(is_admin_user())는 계속 수정 가능. 학년(grade)은 매년 진급하므로
-- 본인이 계속 수정 가능하게 그대로 둔다.

create or replace function public.prevent_student_id_self_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not is_admin_user() then
        if new.class_number is distinct from old.class_number
           or new.student_number is distinct from old.student_number then
            raise exception '반/번호는 본인이 직접 수정할 수 없습니다. 변경이 필요하면 관리자에게 문의해주세요.';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists profiles_lock_student_id on public.profiles;
create trigger profiles_lock_student_id
    before update on public.profiles
    for each row
    execute function public.prevent_student_id_self_edit();
