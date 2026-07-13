-- =====================================================
-- TAECKER 학년(grade) 본인 수정 잠금
-- =====================================================
-- 기존에는 "학년은 매년 진급하니 본인이 계속 수정 가능하게 둔다"는
-- 정책이었으나(sql/lock_class_student_number_edit.sql 참고), 정책이
-- 바뀌어 학년도 반/번호와 동일하게 본인 수정을 막는다.
-- (학년별 게시판 접근 학년을 스스로 바꿔서 우회하는 것을 방지)
--
-- 관리자(is_admin_user())는 계속 수정 가능 (진급 처리 등).

create or replace function public.prevent_student_id_self_edit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if not is_admin_user() then

        if new.class_number is distinct from old.class_number
           or new.student_number is distinct from old.student_number then
            raise exception '반/번호는 본인이 직접 수정할 수 없습니다. 변경이 필요하면 관리자에게 문의해주세요.';
        end if;

        if new.grade is distinct from old.grade then
            raise exception '학년은 본인이 직접 수정할 수 없습니다. 변경이 필요하면 관리자에게 문의해주세요.';
        end if;

    end if;
    return new;
end;
$$;

-- 트리거(profiles_lock_student_id)는 기존 것을 그대로 사용
-- (함수 본문만 교체되었으므로 트리거 재생성 불필요)
