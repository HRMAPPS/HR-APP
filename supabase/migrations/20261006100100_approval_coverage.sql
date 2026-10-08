-- Ringkasan cakupan rantai persetujuan (khusus HR): berapa karyawan yang approver tahap pertamanya sudah/belum punya akun login.
create or replace function public.get_approval_coverage()
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not is_hr() then raise exception 'Akses khusus HR'; end if;
  return (
    with first_step as (
      select e.id, c.o_approver
        from employees e
        cross join lateral (select * from public._resolve_approval_chain(e.id) order by o_step limit 1) c
       where e.employment_status = 'active'
    )
    select json_build_object(
      'employees',          count(*),
      'first_hr',           count(*) filter (where f.o_approver is null),
      'first_no_account',   count(*) filter (where f.o_approver is not null and a.auth_user_id is null),
      'first_with_account', count(*) filter (where f.o_approver is not null and a.auth_user_id is not null),
      'approvers_total',    count(distinct f.o_approver) filter (where f.o_approver is not null),
      'approvers_with_account', count(distinct f.o_approver) filter (where a.auth_user_id is not null))
    from first_step f left join employees a on a.id = f.o_approver
  );
end $$;
revoke execute on function public.get_approval_coverage() from public, anon;
grant  execute on function public.get_approval_coverage() to authenticated;
