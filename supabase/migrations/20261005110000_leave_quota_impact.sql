-- Dampak kuota cuti (khusus HR): berapa karyawan yang pada tahun berjalan sudah memakai/mengajukan
-- lebih dari (atau tepat) p_days hari untuk jenis cuti tertentu. Dipakai tombol "Kuota Cuti" di dashboard HR
-- agar HR melihat dampaknya SEBELUM menyalakan kuota. Hanya membaca data, tidak mengubah apa pun.
create or replace function public.get_leave_quota_impact(p_leave_type_id uuid, p_days numeric)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_year int := extract(year from (now() at time zone 'Asia/Jakarta'))::int;
begin
  if not is_hr() then raise exception 'Akses khusus HR'; end if;
  if p_days is null or p_days < 0 or p_days > 365 then raise exception 'Jumlah hari tidak valid'; end if;
  return (
    select json_build_object(
      'year', v_year,
      'employees_over',     count(*) filter (where d > p_days),
      'employees_at_limit', count(*) filter (where d = p_days))
    from (
      select employee_id, sum(total_days) as d
        from leave_requests
       where leave_type_id = p_leave_type_id and status in ('pending','approved')
         and extract(year from start_date)::int = v_year
       group by employee_id
    ) x
  );
end $$;

revoke execute on function public.get_leave_quota_impact(uuid, numeric) from public, anon;
grant  execute on function public.get_leave_quota_impact(uuid, numeric) to authenticated;
