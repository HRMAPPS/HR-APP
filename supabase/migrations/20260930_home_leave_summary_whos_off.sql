-- Sudah diterapkan ke project Supabase (usdnfufdadpiwreqhjhc). Disimpan di repo sebagai catatan.
--
-- Panel kanan Beranda desktop (mirip Talenta): "Sakit Used", "Unpaid Leave Used", "Who's Off".
-- RLS leave_requests hanya mengizinkan pemilik / atasan / HR membaca, jadi dua fungsi
-- security definer di bawah dipakai supaya semua karyawan bisa melihat data ringkas ini
-- TANPA membuka kolom sensitif (reason, attachment_*, approver_id, dst).

-- 1) Total hari cuti Sakit & Unpaid Leave yang sudah DISETUJUI untuk karyawan yang sedang login,
--    pada tahun berjalan (zona Asia/Jakarta). Dihitung dari leave_requests karena leave_balances kosong.
create or replace function public.get_leave_summary(p_year int default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emp_id uuid := current_employee_id();
  v_year   int  := coalesce(p_year, extract(year from (now() at time zone 'Asia/Jakarta'))::int);
  v_sakit  numeric := 0;
  v_unpaid numeric := 0;
begin
  if v_emp_id is null then
    return json_build_object('year', v_year, 'sakit_used', 0, 'unpaid_used', 0);
  end if;

  select
    coalesce(sum(lr.total_days) filter (where lower(lt.name) = 'sakit'), 0),
    coalesce(sum(lr.total_days) filter (where lower(lt.name) = 'unpaid leave'), 0)
  into v_sakit, v_unpaid
  from leave_requests lr
  join leave_types lt on lt.id = lr.leave_type_id
  where lr.employee_id = v_emp_id
    and lr.status = 'approved'
    and extract(year from lr.start_date)::int = v_year;

  return json_build_object('year', v_year, 'sakit_used', v_sakit, 'unpaid_used', v_unpaid);
end;
$$;

grant execute on function public.get_leave_summary(int) to authenticated;

-- 2) Siapa saja yang sedang cuti pada tanggal tertentu (default: hari ini di Jakarta).
--    Hanya cuti berstatus approved. Hanya mengembalikan nama, foto, jenis cuti, dan rentang tanggal.
create or replace function public.get_whos_off(p_date date default null)
returns table (
  employee_id uuid,
  full_name   text,
  avatar_url  text,
  leave_type  text,
  start_date  date,
  end_date    date
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.full_name, e.avatar_url, lt.name, lr.start_date, lr.end_date
  from leave_requests lr
  join employees e        on e.id = lr.employee_id
  left join leave_types lt on lt.id = lr.leave_type_id
  where auth.uid() is not null
    and lr.status = 'approved'
    and coalesce(p_date, (now() at time zone 'Asia/Jakarta')::date) between lr.start_date and lr.end_date
  order by e.full_name;
$$;

grant execute on function public.get_whos_off(date) to authenticated;
