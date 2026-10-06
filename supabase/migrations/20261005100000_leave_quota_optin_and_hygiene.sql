-- =====================================================================
-- 1) Kebersihan hak akses: cabut hak yang tidak dipakai PostgREST
--    Role 'authenticated' memegang TRUNCATE/TRIGGER/REFERENCES pada 33 tabel public. RLS TIDAK berlaku
--    untuk TRUNCATE. Tidak terjangkau lewat REST API (PostgREST tidak menerbitkan TRUNCATE), tetapi
--    dicabut sebagai pertahanan berlapis.
-- =====================================================================
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- =====================================================================
-- 2) Kuota cuti OPSIONAL per jenis cuti (MATI secara default => perilaku tidak berubah)
--    Aplikasi saat ini menampilkan "Tidak ada kebijakan"; kebijakan (masa kerja, carry-over, cuti khusus
--    per kejadian) adalah keputusan perusahaan. HR menyalakannya per jenis lewat set_leave_policy().
--    Aturan saat menyala: terpakai (approved) + menunggu (pending) + pengajuan baru <= default_days
--    untuk jenis cuti yang sama, per tahun kalender dari tanggal mulai (zona Asia/Jakarta).
-- =====================================================================
alter table public.leave_types add column if not exists enforce_quota boolean not null default false;

create or replace function public.submit_leave_request(
  p_leave_type_id uuid, p_start_date date, p_end_date date, p_reason text,
  p_request_type text default 'full_day', p_attachment_path text default null,
  p_attachment_name text default null, p_delegate_to uuid default null)
returns leave_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_emp_id uuid := current_employee_id();
  v_row leave_requests;
  v_days numeric;
  v_type_name text;
  v_quota numeric;
  v_enforce boolean;
  v_used numeric;
  v_year int;
  v_name text;
begin
  if v_emp_id is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
  if p_request_type not in ('full_day','half_day') then raise exception 'Tipe pengajuan tidak valid'; end if;
  if p_end_date < p_start_date then raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai'; end if;
  if p_request_type = 'half_day' and p_end_date <> p_start_date then
    raise exception 'Cuti setengah hari hanya untuk satu tanggal';
  end if;
  if p_delegate_to is not null then
    if p_delegate_to = v_emp_id then raise exception 'Tidak bisa mendelegasikan ke diri sendiri'; end if;
    if not exists (select 1 from employees where id = p_delegate_to) then raise exception 'Karyawan delegasi tidak ditemukan'; end if;
  end if;
  if p_attachment_path is not null and split_part(p_attachment_path, '/', 1) <> auth.uid()::text then
    raise exception 'Lampiran tidak valid';
  end if;

  select name, default_days, enforce_quota into v_type_name, v_quota, v_enforce
    from leave_types where id = p_leave_type_id;
  if not found then raise exception 'Jenis cuti tidak ditemukan'; end if;

  if exists (
    select 1 from leave_requests
    where employee_id = v_emp_id and status in ('pending','approved')
      and start_date <= p_end_date and end_date >= p_start_date
  ) then
    raise exception 'Tanggal bertabrakan dengan pengajuan cuti Anda yang lain';
  end if;

  v_days := case when p_request_type = 'half_day' then 0.5 else (p_end_date - p_start_date) + 1 end;

  if v_enforce then
    perform pg_advisory_xact_lock(hashtextextended('leave:' || v_emp_id::text, 0));   -- cegah dua pengajuan serentak lolos bersama
    v_year := extract(year from p_start_date)::int;
    select coalesce(sum(total_days), 0) into v_used
      from leave_requests
     where employee_id = v_emp_id and leave_type_id = p_leave_type_id
       and status in ('pending','approved') and extract(year from start_date)::int = v_year;
    if v_used + v_days > coalesce(v_quota, 0) then
      raise exception 'Kuota % tahun % tidak mencukupi: sudah terpakai/menunggu % dari % hari (sisa %)',
        v_type_name, v_year, trim_scale(v_used), trim_scale(coalesce(v_quota, 0)),
        trim_scale(greatest(coalesce(v_quota, 0) - v_used, 0));
    end if;
  end if;

  insert into leave_requests (employee_id, leave_type_id, start_date, end_date, total_days, reason,
                              request_type, attachment_path, attachment_name)
  values (v_emp_id, p_leave_type_id, p_start_date, p_end_date, v_days, nullif(trim(p_reason), ''),
          p_request_type, p_attachment_path, p_attachment_name)
  returning * into v_row;

  perform notify_new_request(v_emp_id, 'Pengajuan cuti baru', coalesce(v_type_name, 'Cuti') || ' · ' || v_days || ' hari', 'leave_requests', v_row.id);

  if p_delegate_to is not null then
    insert into delegations (from_employee_id, to_employee_id, request_type, request_id, start_date, end_date, notes)
    values (v_emp_id, p_delegate_to, 'leave_requests', v_row.id, p_start_date, p_end_date, nullif(trim(p_reason), ''));
    select full_name into v_name from employees where id = v_emp_id;
    insert into notifications (employee_id, title, body, category, related_table, actor_name)
    values (p_delegate_to, 'Anda ditunjuk sebagai delegasi', v_name || ' mendelegasikan tugas saat cuti', 'delegation', 'delegations', v_name);
  end if;

  return v_row;
end $function$;

create or replace function public.get_leave_balances(p_year integer default null)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_emp uuid := current_employee_id();
  v_year int := coalesce(p_year, extract(year from (now() at time zone 'Asia/Jakarta'))::int);
begin
  if v_emp is null then return '[]'::json; end if;
  return (
    select coalesce(json_agg(x order by x.name), '[]'::json) from (
      select lt.id as leave_type_id, lt.name, lt.default_days as quota,
             coalesce(sum(lr.total_days) filter (where lr.status = 'approved'), 0) as used,
             coalesce(sum(lr.total_days) filter (where lr.status = 'pending'), 0) as pending,
             greatest(lt.default_days - coalesce(sum(lr.total_days) filter (where lr.status in ('approved','pending')), 0), 0) as remaining
      from leave_types lt
      left join leave_requests lr on lr.leave_type_id = lt.id and lr.employee_id = v_emp
                                 and extract(year from lr.start_date)::int = v_year
      where lt.enforce_quota
      group by lt.id, lt.name, lt.default_days
    ) x
  );
end $$;

create or replace function public.set_leave_policy(p_leave_type_id uuid, p_enforce boolean, p_days numeric default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_hr() then raise exception 'Akses khusus HR'; end if;
  if p_days is not null and (p_days < 0 or p_days > 365) then raise exception 'Jumlah hari tidak valid'; end if;
  update leave_types set enforce_quota = p_enforce, default_days = coalesce(p_days, default_days)
   where id = p_leave_type_id;
  if not found then raise exception 'Jenis cuti tidak ditemukan'; end if;
end $$;

revoke execute on function public.get_leave_balances(integer) from public, anon;
revoke execute on function public.set_leave_policy(uuid, boolean, numeric) from public, anon;
grant  execute on function public.get_leave_balances(integer) to authenticated;
grant  execute on function public.set_leave_policy(uuid, boolean, numeric) to authenticated;

-- =====================================================================
-- 3) Pengumuman: kaitkan penulis lewat ID, bukan nama (dua karyawan bernama sama tidak lagi saling menimpa)
-- =====================================================================
alter table public.announcements add column if not exists author_id uuid references public.employees(id) on delete set null;

update public.announcements a set author_id = e.id
  from public.employees e
 where a.author_id is null and lower(e.full_name) = lower(a.author)
   and (select count(*) from public.employees x where lower(x.full_name) = lower(a.author)) = 1;

create or replace function public.upsert_announcement_hr(
  p_id uuid, p_title text, p_body text, p_category text default 'Uncategorized',
  p_attachment_url text default null, p_attachment_name text default null)
returns announcements
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_row announcements; v_author_id uuid := current_employee_id(); v_author_name text; v_author_avatar text;
begin
  if not is_hr() then raise exception 'Akses khusus HR'; end if;
  if p_title is null or trim(p_title) = '' then raise exception 'Judul wajib diisi'; end if;
  select full_name, avatar_url into v_author_name, v_author_avatar from employees where id = v_author_id;

  if p_id is null then
    insert into announcements (title, body, author, author_id, author_avatar_url, category, attachment_url, attachment_name)
    values (p_title, p_body, v_author_name, v_author_id, v_author_avatar,
            coalesce(nullif(trim(p_category), ''), 'Uncategorized'), p_attachment_url, p_attachment_name)
    returning * into v_row;
  else
    update announcements set
      title = p_title, body = p_body,
      category = coalesce(nullif(trim(p_category), ''), 'Uncategorized'),
      attachment_url = p_attachment_url, attachment_name = p_attachment_name
    where id = p_id
    returning * into v_row;
  end if;
  return v_row;
end;
$function$;

create or replace function public.sync_announcement_author_avatar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update announcements set author_avatar_url = new.avatar_url, author = new.full_name
   where author_id = new.id;
  return new;
end;
$$;
