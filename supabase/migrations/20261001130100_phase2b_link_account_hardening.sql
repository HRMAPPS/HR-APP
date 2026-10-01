-- FASE 2-B  [TINGGI] Pengambilalihan data karyawan lewat kode karyawan yang mudah ditebak (CK001, CK002, ...).
-- Aturan baru: kode harus cocok DAN email akun harus
--   (a) berdomain perusahaan (napocutid.com), atau
--   (b) sama dengan employees.email / employees.personal_email yang diisi HR.
-- Pesan galat dibuat seragam supaya kode karyawan tidak bisa ditebak lewat respons.
--
-- PENTING (di luar SQL): aktifkan "Confirm email" di Supabase Auth, kalau tidak aturan (a)
-- bisa dilewati dengan mendaftar memakai alamat @napocutid.com milik orang lain tanpa verifikasi.
create or replace function public.link_my_employee_account(p_employee_code text)
returns employees
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c_company_domain constant text := 'napocutid.com';
  v_uid  uuid := auth.uid();
  v_mail text := lower(btrim(coalesce(auth.jwt()->>'email', '')));
  v_row  employees;
begin
  if v_uid is null then
    raise exception 'Anda harus login terlebih dahulu';
  end if;

  if exists (select 1 from employees where auth_user_id = v_uid) then
    raise exception 'Akun Anda sudah terhubung dengan data karyawan';
  end if;

  select * into v_row
  from employees
  where lower(btrim(employee_code)) = lower(btrim(coalesce(p_employee_code, '')))
    and auth_user_id is null
    and v_mail <> ''
    and (   split_part(v_mail, '@', 2) = c_company_domain
         or v_mail = lower(btrim(coalesce(email, '')))
         or v_mail = lower(btrim(coalesce(personal_email, ''))) )
  for update;

  if v_row.id is null then
    raise exception 'Kode karyawan tidak cocok, sudah terhubung, atau tidak dapat dipakai dengan email akun ini. Gunakan email perusahaan, atau minta HR mendaftarkan email pribadi Anda.';
  end if;

  update employees set auth_user_id = v_uid where id = v_row.id returning * into v_row;
  return v_row;
end;
$function$;

revoke execute on function public.link_my_employee_account(text) from public, anon;
grant  execute on function public.link_my_employee_account(text) to authenticated;
