-- =====================================================
-- TAECKER 학번 도용 신고 - "도용 아님" 처리 추가
-- =====================================================
-- 기존에는 도용 신고 처리 결과가 "확정(resolved, 계정 삭제)" /
-- "반려(rejected)" 두 가지뿐이었다. 조사해보니 도용이 아니었던
-- 경우를 반려와 구분해서 남기기 위해 status에 'not_impersonation'
-- 값을 추가로 허용한다.
--
-- impersonation_reports.status에 CHECK 제약이 걸려 있다면 새
-- 값을 막아버리므로, 존재하는 CHECK 제약을 찾아 지우고
-- pending/resolved/rejected/not_impersonation 네 값을 허용하는
-- 제약으로 다시 만든다. (idempotent, 여러 번 실행해도 안전)

do $$
declare
    v_constraint_name text;
begin

    select con.conname
    into v_constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'impersonation_reports'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%';

    if v_constraint_name is not null then
        execute format(
            'alter table public.impersonation_reports drop constraint %I',
            v_constraint_name
        );
    end if;

    alter table public.impersonation_reports
        add constraint impersonation_reports_status_check
        check (status in ('pending','resolved','rejected','not_impersonation'));

end;
$$;
