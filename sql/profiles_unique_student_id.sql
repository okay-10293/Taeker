-- =====================================================
-- TAECKER 학번(학년+반+번호) 중복 가입 방지
-- 주의: 이 파일은 실제 운영 DB에 이미 적용되어 있던 내용을
--       소급 기록한 것입니다 (마이그레이션 이력 누락 백필).
--       idempotent(중복 실행 안전)하게 작성했습니다.
-- =====================================================

-- 프론트(register.html)에서 회원가입 전 checkStudentId()로 먼저 확인하지만,
-- 동시에 같은 학번으로 가입을 시도하는 race condition을 막기 위해
-- DB 레벨에서도 유니크 인덱스로 강제한다.
-- (닉네임에 이미 걸려있는 unique 제약과 동일한 패턴)
create unique index if not exists profiles_grade_class_student_key
    on public.profiles (grade, class_number, student_number)
    where grade is not null and class_number is not null and student_number is not null;
