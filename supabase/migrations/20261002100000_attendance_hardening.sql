-- =====================================================================
-- PENGAMANAN ABSENSI (presensi online: GPS + wajah + foto)
--
-- Temuan yang dibuktikan di database:
--  1. [KRITIS] face_descriptor_distance memakai sum(), yang MENGABAIKAN elemen NULL. Descriptor berisi
--     128 NULL menghasilkan jarak NULL; "NULL > 0.6" tidak pernah benar => verifikasi wajah LOLOS.
--     Dengan koordinat gudang (terbaca semua user) clock_in berhasil dari mana saja, tanpa kamera & foto.
--  2. [TINGGI] descriptor wajah milik sendiri bisa dibaca klien (policy SELECT) => bisa di-replay.
--  3. [TINGGI] enroll_face bisa menimpa wajah terdaftar dengan wajah siapa pun, kapan pun.
--  4. [SEDANG] foto tidak diwajibkan/diverifikasi server; tidak ada jejak audit; GPS tanpa sinyal kualitas.
--
-- Perbaikan:
--  * validasi descriptor ketat (panjang, NULL, NaN/Infinity, rentang, norma) + jarak NULL = DITOLAK
--  * descriptor wajah tidak lagi bisa dibaca/ditulis klien (hanya lewat RPC); HR dapat mereset wajah
--  * pendaftaran ulang wajah harus tetap cocok dengan wajah lama (kecuali direset HR), dibatasi 5x/hari
--  * foto wajib: milik sendiri, benar-benar ada di storage, baru diunggah (<10 menit), tidak boleh dipakai ulang
--  * deteksi replay: descriptor identik dengan sebelumnya ditolak; hampir identik ditandai
--  * jejak audit attendance_events (IP, user agent, perangkat, akurasi GPS, jarak wajah) + tanda risiko
--    yang hanya terlihat HR. Tanda bersifat INFORMATIF (tidak memblokir) agar tidak menghukum karyawan jujur.
--  * clock_in/clock_out kompatibel mundur: parameter baru opsional (frontend lama tetap berjalan)
-- =====================================================================

-- ---------- 1) Jejak audit (tanpa akses klien sama sekali) ----------
create table if not exists public.attendance_events (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  kind          text not null check (kind in ('in','out','enroll','reset')),
  work_date     date not null default current_date,
  created_at    timestamptz not null default now(),
  lat           numeric,
  lng           numeric,
  accuracy      numeric,
  fix_time      timestamptz,
  device_id     text,
  user_agent    text,
  ip            text,
  photo_path    text,
  face_distance double precision,
  descriptor    double precision[],            -- hanya 10 terbaru per karyawan (deteksi replay)
  flags         text[] not null default '{}'
);
create index if not exists attendance_events_emp_time on public.attendance_events (employee_id, created_at desc);
create index if not exists attendance_events_emp_date on public.attendance_events (employee_id, work_date);
create unique index if not exists attendance_events_photo_once on public.attendance_events (photo_path) where photo_path is not null;
alter table public.attendance_events enable row level security;
revoke all on public.attendance_events from anon, authenticated;

-- ---------- 2) Kunci data biometrik: klien tidak boleh membaca/menulis langsung ----------
drop policy if exists face_descriptors_select_own_or_hr on public.face_descriptors;
drop policy if exists face_descriptors_insert_own       on public.face_descriptors;
drop policy if exists face_descriptors_update_own       on public.face_descriptors;
drop policy if exists face_descriptors_delete_own_or_hr on public.face_descriptors;
revoke all on public.face_descriptors from anon, authenticated;

-- ---------- 3) Validasi & jarak wajah yang ketat ----------
create or replace function public._check_face_descriptor(p double precision[])
returns void
language plpgsql
immutable
set search_path to 'public'
as $$
declare v_bad int; v_n2 double precision;
begin
  if p is null or array_ndims(p) is distinct from 1 or array_length(p, 1) <> 128 then
    raise exception 'Verifikasi wajah gagal, wajah tidak terdeteksi dengan jelas. Coba lagi.';
  end if;
  select count(*) filter (where v is null or v = 'NaN'::float8 or abs(v) > 1.5), coalesce(sum(v * v), 0)
    into v_bad, v_n2 from unnest(p) v;
  if v_bad > 0 or v_n2 < 0.5 or v_n2 > 4 then
    raise exception 'Data wajah tidak valid. Ambil foto langsung dari kamera.';
  end if;
end $$;

-- NULL bila salah satu larik tidak valid (pemanggil WAJIB memperlakukan NULL sebagai gagal)
create or replace function public.face_descriptor_distance(a double precision[], b double precision[])
returns double precision
language sql
immutable
set search_path to 'public'
as $$
  select case
    when a is null or b is null or array_length(a, 1) is distinct from array_length(b, 1)
      or exists (select 1 from unnest(a) v where v is null)
      or exists (select 1 from unnest(b) v where v is null) then null
    else (select sqrt(sum(pow(x - y, 2))) from unnest(a, b) as t(x, y))
  end;
$$;

create or replace function public._request_meta()
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $$
declare h jsonb;
begin
  begin h := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then h := null; end;
  return jsonb_build_object(
    'ua', left(coalesce(h->>'user-agent', ''), 300),
    'ip', left(btrim(split_part(coalesce(h->>'x-forwarded-for', h->>'x-real-ip', ''), ',', 1)), 64));
end $$;

-- ---------- 4) Penjaga bersama untuk clock_in / clock_out ----------
create or replace function public._attendance_guard(
  p_kind text, p_lat numeric, p_lng numeric, p_photo text, p_desc double precision[],
  p_accuracy numeric, p_fix_time timestamptz, p_device_id text)
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_emp   uuid := current_employee_id();
  v_uid   uuid := auth.uid();
  v_flags text[] := '{}';
  v_stored double precision[];
  v_dist  double precision;
  v_min_prev double precision;
  v_path  text;
  v_meta  jsonb := public._request_meta();
  v_prev  attendance_events;
  v_loc   record;
  v_m     numeric;
  v_dev   text := nullif(left(btrim(coalesce(p_device_id, '')), 64), '');
begin
  if v_emp is null then raise exception 'Profil karyawan tidak ditemukan'; end if;

  -- (a) lokasi: radius yang diizinkan
  perform check_attendance_radius(p_lat, p_lng);

  -- (b) wajah: validasi ketat + cocok dengan wajah terdaftar
  select descriptor into v_stored from face_descriptors where employee_id = v_emp;
  if v_stored is null then
    raise exception 'Wajah belum terdaftar. Silakan daftarkan wajah terlebih dahulu di halaman Akun.';
  end if;
  perform public._check_face_descriptor(p_desc);
  v_dist := face_descriptor_distance(v_stored, p_desc);
  if v_dist is null or v_dist > 0.6 then
    raise exception 'Wajah tidak cocok dengan wajah terdaftar. Absen ditolak.';
  end if;
  if v_dist > 0.5 then v_flags := array_append(v_flags, 'face_weak_match'); end if;

  -- replay: data wajah identik dengan pengajuan sebelumnya / data terdaftar = bukan tangkapan kamera baru
  select min(face_descriptor_distance(e.descriptor, p_desc)) into v_min_prev
    from (select descriptor from attendance_events
           where employee_id = v_emp and descriptor is not null order by created_at desc limit 10) e;
  if v_dist < 0.004 or coalesce(v_min_prev, 1) < 0.004 then
    raise exception 'Verifikasi wajah ditolak: data wajah identik dengan sebelumnya. Ambil foto langsung dari kamera.';
  end if;
  if v_dist < 0.03 or coalesce(v_min_prev, 1) < 0.03 then v_flags := array_append(v_flags, 'face_near_identical'); end if;

  -- (c) foto selfie wajib, milik sendiri, baru diunggah, dan sekali pakai
  if p_photo is null or btrim(p_photo) = '' then
    raise exception 'Foto selfie diperlukan untuk absen.';
  end if;
  v_path := split_part(p_photo, '?', 1);
  if position('/attendance-photos/' in v_path) > 0 then
    v_path := substring(v_path from position('/attendance-photos/' in v_path) + length('/attendance-photos/'));
  end if;
  if split_part(v_path, '/', 1) <> v_uid::text then
    raise exception 'Foto tidak valid.';
  end if;
  if not exists (select 1 from storage.objects o
                  where o.bucket_id = 'attendance-photos' and o.name = v_path
                    and o.created_at > now() - interval '10 minutes') then
    raise exception 'Foto selfie tidak ditemukan atau sudah kedaluwarsa. Ambil foto ulang.';
  end if;
  if exists (select 1 from attendance_events where photo_path = v_path) then
    raise exception 'Foto sudah pernah dipakai. Ambil foto baru.';
  end if;

  -- (d) sinyal risiko GPS / perangkat (informatif, tidak memblokir)
  if p_lat is not null and p_lng is not null then
    if p_accuracy is null then v_flags := array_append(v_flags, 'gps_no_accuracy');
    elsif p_accuracy <= 0   then v_flags := array_append(v_flags, 'gps_accuracy_zero');
    elsif p_accuracy > 100  then v_flags := array_append(v_flags, 'gps_low_accuracy');
    end if;
    if p_fix_time is not null and now() - p_fix_time > interval '2 minutes' then v_flags := array_append(v_flags, 'gps_stale'); end if;
    if round(p_lat, 3) = p_lat and round(p_lng, 3) = p_lng then v_flags := array_append(v_flags, 'gps_round_coords'); end if;

    select l.name as name, distance_meters(p_lat, p_lng, l.lat, l.lng) as d into v_loc
      from attendance_locations l order by distance_meters(p_lat, p_lng, l.lat, l.lng) limit 1;
    if v_loc.d is not null and v_loc.d < 3 then v_flags := array_append(v_flags, 'gps_exact_office_center'); end if;

    select * into v_prev from attendance_events where employee_id = v_emp and lat is not null order by created_at desc limit 1;
    if v_prev.id is not null then
      if v_prev.lat = p_lat and v_prev.lng = p_lng then v_flags := array_append(v_flags, 'gps_identical_to_previous'); end if;
      v_m := distance_meters(v_prev.lat, v_prev.lng, p_lat, p_lng);
      if now() - v_prev.created_at < interval '6 hours' and v_m > 500
         and v_m / greatest(extract(epoch from now() - v_prev.created_at), 1) > 55 then
        v_flags := array_append(v_flags, 'impossible_travel');
      end if;
    end if;
  end if;

  if v_dev is null then
    v_flags := array_append(v_flags, 'no_device_id');
  elsif exists (select 1 from attendance_events where employee_id = v_emp and device_id is not null)
    and not exists (select 1 from attendance_events where employee_id = v_emp and device_id = v_dev) then
    v_flags := array_append(v_flags, 'new_device');
  end if;

  insert into attendance_events (employee_id, kind, work_date, lat, lng, accuracy, fix_time, device_id,
                                 user_agent, ip, photo_path, face_distance, descriptor, flags)
  values (v_emp, p_kind, current_date, p_lat, p_lng, p_accuracy, p_fix_time, v_dev,
          v_meta->>'ua', v_meta->>'ip', v_path, v_dist, p_desc, v_flags);

  -- simpan descriptor hanya untuk 10 kejadian terbaru; hapus jejak > 180 hari
  update attendance_events set descriptor = null
   where employee_id = v_emp and descriptor is not null
     and id not in (select id from attendance_events where employee_id = v_emp order by created_at desc limit 10);
  delete from attendance_events where employee_id = v_emp and created_at < now() - interval '180 days';

  return v_flags;
end;
$$;

revoke execute on function public._check_face_descriptor(double precision[]) from public, anon, authenticated;
revoke execute on function public._request_meta() from public, anon, authenticated;
revoke execute on function public._attendance_guard(text, numeric, numeric, text, double precision[], numeric, timestamptz, text) from public, anon, authenticated;

-- ---------- 5) clock_in / clock_out (parameter baru opsional => klien lama tetap jalan) ----------
drop function if exists public.clock_in(numeric, numeric, text, text, double precision[]);
drop function if exists public.clock_out(numeric, numeric, text, text, double precision[]);

create or replace function public.clock_in(
  p_lat numeric default null, p_lng numeric default null, p_photo_url text default null, p_notes text default null,
  p_face_descriptor double precision[] default null,
  p_accuracy numeric default null, p_fix_time timestamptz default null, p_device_id text default null)
returns attendance
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_emp_id uuid := current_employee_id();
  v_row attendance;
  v_shift_start time;
  v_flags text[];
begin
  if v_emp_id is null then raise exception 'Profil karyawan tidak ditemukan'; end if;

  v_flags := public._attendance_guard('in', p_lat, p_lng, p_photo_url, p_face_descriptor, p_accuracy, p_fix_time, p_device_id);

  select sh.start_time into v_shift_start
  from shift_schedules ss join shifts sh on sh.id = ss.shift_id
  where ss.employee_id = v_emp_id and ss.work_date = current_date;

  if v_shift_start is null then
    select sh.start_time into v_shift_start
    from employees e join shifts sh on sh.id = e.default_shift_id
    where e.id = v_emp_id;
  end if;

  insert into attendance (employee_id, work_date, clock_in, clock_in_lat, clock_in_lng, clock_in_photo_url, clock_in_notes, status)
  values (
    v_emp_id, current_date, now(), p_lat, p_lng, p_photo_url, left(p_notes, 500),
    case when v_shift_start is not null and current_time > v_shift_start + interval '5 minutes'
         then 'late' else 'on_time' end
  )
  on conflict (employee_id, work_date) do update
    set clock_in = excluded.clock_in,
        clock_in_lat = excluded.clock_in_lat,
        clock_in_lng = excluded.clock_in_lng,
        clock_in_photo_url = excluded.clock_in_photo_url,
        clock_in_notes = excluded.clock_in_notes
    where attendance.clock_in is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Anda sudah melakukan clock in hari ini';
  end if;

  return v_row;
end;
$function$;

create or replace function public.clock_out(
  p_lat numeric default null, p_lng numeric default null, p_photo_url text default null, p_notes text default null,
  p_face_descriptor double precision[] default null,
  p_accuracy numeric default null, p_fix_time timestamptz default null, p_device_id text default null)
returns attendance
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_emp_id uuid := current_employee_id();
  v_row attendance;
  v_flags text[];
begin
  if v_emp_id is null then raise exception 'Profil karyawan tidak ditemukan'; end if;

  v_flags := public._attendance_guard('out', p_lat, p_lng, p_photo_url, p_face_descriptor, p_accuracy, p_fix_time, p_device_id);

  update attendance
    set clock_out = now(), clock_out_lat = p_lat, clock_out_lng = p_lng,
        clock_out_photo_url = p_photo_url, clock_out_notes = left(p_notes, 500)
    where employee_id = v_emp_id and work_date = current_date and clock_out is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Anda belum clock in, atau sudah clock out hari ini';
  end if;

  if v_row.clock_out - v_row.clock_in < interval '30 minutes' then
    update attendance_events set flags = array_append(flags, 'short_shift')
     where id = (select id from attendance_events where employee_id = v_emp_id and kind = 'out'
                  order by created_at desc limit 1);
  end if;

  return v_row;
end;
$function$;

revoke execute on function public.clock_in(numeric, numeric, text, text, double precision[], numeric, timestamptz, text) from public, anon;
revoke execute on function public.clock_out(numeric, numeric, text, text, double precision[], numeric, timestamptz, text) from public, anon;
grant  execute on function public.clock_in(numeric, numeric, text, text, double precision[], numeric, timestamptz, text) to authenticated;
grant  execute on function public.clock_out(numeric, numeric, text, text, double precision[], numeric, timestamptz, text) to authenticated;

-- ---------- 6) Pendaftaran wajah: validasi, harus cocok dengan wajah lama, dibatasi; reset oleh HR ----------
create or replace function public.enroll_face(p_descriptor double precision[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_emp_id uuid := current_employee_id();
  v_old double precision[];
  v_d double precision;
  v_meta jsonb := public._request_meta();
begin
  if v_emp_id is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
  perform public._check_face_descriptor(p_descriptor);

  if (select count(*) from attendance_events
       where employee_id = v_emp_id and kind = 'enroll' and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Terlalu sering mendaftarkan ulang wajah. Coba lagi besok atau hubungi HR.';
  end if;

  select descriptor into v_old from face_descriptors where employee_id = v_emp_id;
  if v_old is not null then
    v_d := face_descriptor_distance(v_old, p_descriptor);
    if v_d is null or v_d > 0.6 then
      raise exception 'Wajah baru tidak cocok dengan wajah yang sudah terdaftar. Hubungi HR untuk mereset data wajah Anda.';
    end if;
  end if;

  insert into face_descriptors (employee_id, descriptor, updated_at)
  values (v_emp_id, p_descriptor, now())
  on conflict (employee_id) do update
    set descriptor = excluded.descriptor, updated_at = excluded.updated_at;

  insert into attendance_events (employee_id, kind, user_agent, ip, face_distance, flags)
  values (v_emp_id, 'enroll', v_meta->>'ua', v_meta->>'ip', v_d,
          case when v_old is not null then array['face_reenrolled'] else '{}'::text[] end);
end;
$function$;

create or replace function public.hr_reset_face(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_hr() then raise exception 'Akses khusus HR'; end if;
  delete from face_descriptors where employee_id = p_employee_id;
  if not found then raise exception 'Karyawan tersebut belum mendaftarkan wajah'; end if;
  insert into attendance_events (employee_id, kind, flags) values (p_employee_id, 'reset', array['face_reset_by_hr']);
end $$;
revoke execute on function public.hr_reset_face(uuid) from public, anon;
grant  execute on function public.hr_reset_face(uuid) to authenticated;

-- ---------- 7) HR: tanda risiko di daftar & detail absensi ----------
create or replace function public.get_hr_attendance(p_start date default null, p_end date default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_result json;
begin
  if not is_hr() then raise exception 'Akses khusus HR'; end if;
  select coalesce(json_agg(a order by a.work_date desc, a.full_name), '[]'::json) into v_result from (
    select att.id, att.work_date, att.clock_in, att.clock_out, att.status,
           emp.full_name, emp.employee_code, emp.position, emp.department,
           coalesce(fl.flags, '{}') as flags
    from attendance att
    join employees emp on emp.id = att.employee_id
    left join lateral (
      select array_agg(distinct f) as flags
      from attendance_events ev, unnest(ev.flags) f
      where ev.employee_id = att.employee_id and ev.work_date = att.work_date and ev.kind in ('in', 'out')
    ) fl on true
    where (p_start is null or att.work_date >= p_start)
      and (p_end is null or att.work_date <= p_end)
  ) a;
  return v_result;
end;
$function$;

create or replace function public.get_hr_attendance_detail(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v json;
begin
  if not is_hr() then raise exception 'Akses khusus HR'; end if;

  select row_to_json(d) into v from (
    select att.id, att.employee_id, att.work_date, att.status, att.clock_in, att.clock_out,
           att.clock_in_lat, att.clock_in_lng, att.clock_out_lat, att.clock_out_lng,
           att.clock_in_photo_url, att.clock_out_photo_url, att.clock_in_notes, att.clock_out_notes,
           emp.full_name, emp.employee_code, emp.position, emp.department,
           sh.name as shift_name, sh.start_time as shift_start, sh.end_time as shift_end,
           li.name as clock_in_location, li.dist as clock_in_distance_m, li.radius_meters as clock_in_radius_m,
           lo.name as clock_out_location, lo.dist as clock_out_distance_m, lo.radius_meters as clock_out_radius_m,
           (select coalesce(json_agg(json_build_object(
                     'kind', ev.kind, 'at', ev.created_at, 'accuracy', ev.accuracy, 'device_id', ev.device_id,
                     'user_agent', ev.user_agent, 'ip', ev.ip, 'face_distance', ev.face_distance, 'flags', ev.flags)
                   order by ev.created_at), '[]'::json)
              from attendance_events ev
             where ev.employee_id = att.employee_id and ev.work_date = att.work_date and ev.kind in ('in', 'out')) as security_events
    from attendance att
    join employees emp on emp.id = att.employee_id
    left join lateral (
      select * from shift_schedules ss
      where ss.employee_id = att.employee_id and ss.work_date = att.work_date limit 1
    ) sch on true
    left join shifts sh on sh.id = case when sch.id is not null then sch.shift_id else emp.default_shift_id end
    left join lateral (
      select l.name, l.radius_meters,
             round(6371000 * 2 * asin(sqrt(
               power(sin(radians((att.clock_in_lat - l.lat) / 2)), 2) +
               cos(radians(l.lat)) * cos(radians(att.clock_in_lat)) *
               power(sin(radians((att.clock_in_lng - l.lng) / 2)), 2))))::int as dist
      from attendance_locations l
      where att.clock_in_lat is not null and att.clock_in_lng is not null
      order by dist limit 1
    ) li on true
    left join lateral (
      select l.name, l.radius_meters,
             round(6371000 * 2 * asin(sqrt(
               power(sin(radians((att.clock_out_lat - l.lat) / 2)), 2) +
               cos(radians(l.lat)) * cos(radians(att.clock_out_lat)) *
               power(sin(radians((att.clock_out_lng - l.lng) / 2)), 2))))::int as dist
      from attendance_locations l
      where att.clock_out_lat is not null and att.clock_out_lng is not null
      order by dist limit 1
    ) lo on true
    where att.id = p_id
  ) d;

  return v;
end;
$function$;
