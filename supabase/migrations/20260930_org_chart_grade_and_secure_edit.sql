-- Sudah diterapkan ke project Supabase (usdnfufdadpiwreqhjhc). Disimpan di repo sebagai catatan.

-- 1) Golongan (1..5 = Golongan I..V)
alter table public.employees add column if not exists grade smallint;
alter table public.employees drop constraint if exists employees_grade_check;
alter table public.employees add constraint employees_grade_check check (grade is null or grade between 1 and 5);
comment on column public.employees.grade is 'Golongan karyawan: 1=I (Staff), 2=II (SPV/Leader), 3=III (Manager), 4=IV (Head), 5=V (BOD & Advisor)';

-- 2) get_org_chart ikut mengirim golongan (emp.grade)
-- 3) update_employee_org(p_employee_id, p_department_id, p_manager_id, p_grade, p_position):
--    hanya HR/Admin (is_hr()), menolak atasan diri sendiri / bawahannya (cegah loop).
-- 4) update_employee_manager, update_employee_department, upsert_department, delete_department
--    sekarang juga mewajibkan is_hr() (sebelumnya bisa dipanggil semua user login).
-- Definisi lengkap fungsi: lihat `select pg_get_functiondef('public.update_employee_org'::regproc)` di database.
