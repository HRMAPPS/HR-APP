-- FASE 2-A  [KRITIS - PII]
-- Sebelumnya semua akun login bisa membaca NIK, rekening bank, NPWP, BPJS, alamat KTP,
-- tanggal lahir, kontak darurat SEMUA karyawan lewat tabel employees.
-- Sekarang hanya kolom non-sensitif yang bisa dibaca langsung. Data pribadi diambil lewat
-- RPC SECURITY DEFINER (get_profile_detail untuk diri sendiri, get_hr_* untuk HR).
--
-- !!! JALANKAN SETELAH frontend baru ter-deploy (useAuth.js tidak lagi memakai select('*')). !!!
-- Daftar kolom harus sama dengan EMPLOYEE_COLUMNS di src/lib/useAuth.js.

revoke select on public.employees from authenticated;
grant select (
  id, auth_user_id, employee_code, full_name, position, department, department_id,
  phone, email, avatar_url, manager_id, join_date, employment_status, role, grade,
  default_shift_id, default_work_days, created_at
) on public.employees to authenticated;

-- Frontend tidak pernah menulis ke employees secara langsung (semua lewat RPC SECURITY DEFINER),
-- jadi tutup tulis langsung. Trigger penjaga kolom dari fase 1 tetap ada sebagai lapisan kedua.
revoke insert, update, delete, truncate on public.employees from authenticated;
