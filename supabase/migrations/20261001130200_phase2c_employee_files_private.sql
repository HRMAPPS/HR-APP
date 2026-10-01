-- FASE 2-C  [TINGGI] Bucket employee-files (KTP, ijazah, dll.) sebelumnya PUBLIC:
-- bisa dibaca dan di-list siapa pun tanpa login. Jadikan private; baca hanya oleh
-- pemilik folder, HR, atau atasan langsung. Frontend memakai signed URL (src/lib/employeeFiles.js).
--
-- !!! JALANKAN SETELAH frontend baru ter-deploy. Link publik lama berhenti bekerja
--     (saat ini hanya 1 file yatim dan 0 baris di employee_files, jadi tidak ada yang rusak). !!!
update storage.buckets set public = false where id = 'employee-files';

drop policy if exists "employee files read all" on storage.objects;
drop policy if exists "employee files read allowed" on storage.objects;
create policy "employee files read allowed" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'employee-files'
    and (
      (storage.foldername(name))[1] in (auth.uid()::text, public.current_employee_id()::text)
      or public.is_hr()
      or exists (
        select 1 from public.employees e
        where (e.auth_user_id::text = (storage.foldername(objects.name))[1]
            or e.id::text           = (storage.foldername(objects.name))[1])
          and e.manager_id = public.current_employee_id()
      )
    )
  );
