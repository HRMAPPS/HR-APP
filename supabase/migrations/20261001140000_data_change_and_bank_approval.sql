-- =====================================================================
-- Alur persetujuan "Perubahan Data" + persetujuan HR untuk ganti rekening bank
--
-- Sebelumnya:
--  * data_change_requests tidak pernah bisa diproses (decide_request/get_my_approvals tidak mengenalnya)
--  * field_name, old_value dan new_value tidak divalidasi (old_value dipercaya dari klien)
--  * update_payroll_info langsung menimpa rekening bank (akun dibajak => rekening gaji bisa dialihkan)
-- Sekarang:
--  * phone / email / full_name / rekening bank => pengajuan, HANYA HR yang dapat menyetujui
--    (atasan langsung tidak melihat rekening bawahannya)
--  * nilai divalidasi & dinormalisasi di server; old_value diambil dari database
--  * NPWP dan BPJS tetap langsung tersimpan (tidak mengalihkan pembayaran)
-- =====================================================================

-- ---------- 1) Constraint tabel (tabel masih kosong saat migration ini dibuat) ----------
alter table public.data_change_requests
  drop constraint if exists dcr_field_chk,
  drop constraint if exists dcr_status_chk;
alter table public.data_change_requests
  add constraint dcr_field_chk  check (field_name in ('phone','email','full_name','bank_account')),
  add constraint dcr_status_chk check (status in ('pending','approved','rejected','cancelled'));
create unique index if not exists dcr_one_pending_per_field
  on public.data_change_requests (employee_id, field_name) where status = 'pending';

-- ---------- 2) Validasi & normalisasi (internal) ----------
create or replace function public._normalize_data_change(p_field text, p_value text)
returns text
language plpgsql
immutable
set search_path to 'public'
as $$
declare v text := coalesce(p_value, '');
begin
  if p_field = 'phone' then
    v := regexp_replace(v, '[\s\-\.\(\)]', '', 'g');
    if v !~ '^\+?[0-9]{8,15}$' then raise exception 'Nomor telepon tidak valid (8-15 digit)'; end if;
  elsif p_field = 'email' then
    v := lower(btrim(v));
    if length(v) > 254 or v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Format email tidak valid'; end if;
  elsif p_field = 'full_name' then
    v := regexp_replace(btrim(v), '\s+', ' ', 'g');
    if length(v) < 2 or length(v) > 100 or v ~ '[[:cntrl:]]' then raise exception 'Nama lengkap tidak valid'; end if;
  else
    raise exception 'Jenis data tidak dapat diubah lewat pengajuan ini';
  end if;
  return v;
end $$;

create or replace function public._apply_data_change(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare r data_change_requests; j jsonb;
begin
  select * into r from data_change_requests where id = p_id;
  if r.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;

  if r.field_name = 'bank_account' then
    j := r.new_value::jsonb;
    update employees set bank_name = j->>'bank_name',
                         bank_account_number = j->>'bank_account_number',
                         bank_account_holder = j->>'bank_account_holder'
     where id = r.employee_id;
  elsif r.field_name = 'phone' then
    update employees set phone = public._normalize_data_change('phone', r.new_value) where id = r.employee_id;
  elsif r.field_name = 'full_name' then
    update employees set full_name = public._normalize_data_change('full_name', r.new_value) where id = r.employee_id;
  elsif r.field_name = 'email' then
    if exists (select 1 from employees where id <> r.employee_id
                and lower(btrim(email)) = lower(btrim(r.new_value))) then
      raise exception 'Email tersebut sudah dipakai karyawan lain';
    end if;
    update employees set email = public._normalize_data_change('email', r.new_value) where id = r.employee_id;
  else
    raise exception 'Jenis perubahan tidak dikenali';
  end if;
end $$;

revoke execute on function public._normalize_data_change(text, text) from public, anon, authenticated;
revoke execute on function public._apply_data_change(uuid)           from public, anon, authenticated;

-- ---------- 3) Pengajuan perubahan data (signature tetap, frontend lama tetap jalan) ----------
create or replace function public.submit_data_change_request(
  p_field_name text, p_old_value text, p_new_value text, p_reason text)
returns data_change_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_emp uuid := current_employee_id();
  v_name text;
  v_new text;
  v_old text;
  v_row data_change_requests;
  v_label text;
begin
  if v_emp is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
  if p_field_name not in ('phone', 'email', 'full_name') then
    raise exception 'Jenis data tidak dapat diubah lewat pengajuan ini';
  end if;

  v_new := public._normalize_data_change(p_field_name, p_new_value);
  execute format('select %I::text from employees where id = $1', p_field_name) into v_old using v_emp;   -- dari DB, bukan dari klien

  if lower(btrim(coalesce(v_old, ''))) = lower(v_new) then
    raise exception 'Data baru sama dengan data saat ini';
  end if;
  if p_field_name = 'email' and exists (
       select 1 from employees where id <> v_emp and lower(btrim(email)) = v_new) then
    raise exception 'Email tersebut tidak dapat digunakan';
  end if;
  if exists (select 1 from data_change_requests
              where employee_id = v_emp and field_name = p_field_name and status = 'pending') then
    raise exception 'Masih ada pengajuan serupa yang menunggu persetujuan';
  end if;

  insert into data_change_requests (employee_id, field_name, old_value, new_value, reason)
  values (v_emp, p_field_name, v_old, v_new, left(btrim(coalesce(p_reason, '')), 500))
  returning * into v_row;

  select full_name into v_name from employees where id = v_emp;
  v_label := case p_field_name when 'phone' then 'Nomor telepon' when 'email' then 'Email' else 'Nama lengkap' end;
  insert into notifications (employee_id, title, body, category, related_table, related_id, actor_name)
  select e.id, 'Pengajuan perubahan data baru', v_label, 'approval', 'data_change_requests', v_row.id, v_name
    from employees e where e.role in ('hr', 'admin') and e.id <> v_emp;

  return v_row;
end;
$function$;

-- ---------- 4) Info payroll: NPWP/BPJS langsung, rekening bank => pengajuan ke HR ----------
create or replace function public.update_payroll_info(
  p_bank_name text default null, p_bank_account_number text default null, p_bank_account_holder text default null,
  p_npwp text default null, p_bpjs_kesehatan text default null, p_bpjs_ketenagakerjaan text default null)
returns employees
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_emp uuid := current_employee_id();
  v_cur employees;
  v_row employees;
  v_bn text; v_an text; v_ah text;
  v_cbn text; v_can text; v_cah text;
  v_id uuid; v_name text;
begin
  if v_emp is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
  select * into v_cur from employees where id = v_emp;

  update employees set
    npwp = nullif(regexp_replace(coalesce(p_npwp, ''), '\s', '', 'g'), ''),
    bpjs_kesehatan = nullif(regexp_replace(coalesce(p_bpjs_kesehatan, ''), '\s', '', 'g'), ''),
    bpjs_ketenagakerjaan = nullif(regexp_replace(coalesce(p_bpjs_ketenagakerjaan, ''), '\s', '', 'g'), '')
  where id = v_emp;

  v_bn  := nullif(btrim(coalesce(p_bank_name, '')), '');
  v_an  := nullif(regexp_replace(coalesce(p_bank_account_number, ''), '[\s\-\.]', '', 'g'), '');
  v_ah  := nullif(regexp_replace(btrim(coalesce(p_bank_account_holder, '')), '\s+', ' ', 'g'), '');
  v_cbn := nullif(btrim(coalesce(v_cur.bank_name, '')), '');
  v_can := nullif(regexp_replace(coalesce(v_cur.bank_account_number, ''), '[\s\-\.]', '', 'g'), '');
  v_cah := nullif(regexp_replace(btrim(coalesce(v_cur.bank_account_holder, '')), '\s+', ' ', 'g'), '');

  if v_bn is distinct from v_cbn or v_an is distinct from v_can or v_ah is distinct from v_cah then
    if v_bn is null or v_an is null or v_ah is null then
      raise exception 'Lengkapi nama bank, nomor rekening, dan atas nama (tidak boleh dikosongkan)';
    end if;
    if v_an !~ '^[0-9]{5,25}$' then raise exception 'Nomor rekening hanya boleh berisi angka (5-25 digit)'; end if;
    if length(v_bn) > 60 or length(v_ah) > 100 then raise exception 'Nama bank atau atas nama terlalu panjang'; end if;

    delete from data_change_requests where employee_id = v_emp and field_name = 'bank_account' and status = 'pending';
    insert into data_change_requests (employee_id, field_name, old_value, new_value, reason)
    values (v_emp, 'bank_account',
            jsonb_build_object('bank_name', v_cbn, 'bank_account_number', v_can, 'bank_account_holder', v_cah)::text,
            jsonb_build_object('bank_name', v_bn, 'bank_account_number', v_an, 'bank_account_holder', v_ah)::text,
            'Perubahan rekening gaji')
    returning id into v_id;

    insert into notifications (employee_id, title, body, category, related_table, related_id, actor_name)
    select e.id, 'Pengajuan perubahan rekening bank', 'Perlu verifikasi HR sebelum gaji berikutnya', 'approval',
           'data_change_requests', v_id, v_cur.full_name
      from employees e where e.role in ('hr', 'admin') and e.id <> v_emp;
  end if;

  select * into v_row from employees where id = v_emp;
  return v_row;
end;
$function$;

create or replace function public.my_pending_bank_change()
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  select row_to_json(x) from (
    select id, created_at, new_value::jsonb as new_value
      from data_change_requests
     where employee_id = current_employee_id() and field_name = 'bank_account' and status = 'pending'
     limit 1
  ) x;
$$;

create or replace function public.cancel_my_data_change(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update data_change_requests set status = 'cancelled', decided_at = now()
   where id = p_id and employee_id = current_employee_id() and status = 'pending';
  if not found then raise exception 'Pengajuan tidak ditemukan atau sudah diproses'; end if;
end $$;

revoke execute on function public.my_pending_bank_change(), public.cancel_my_data_change(uuid) from public, anon;
grant  execute on function public.my_pending_bank_change(), public.cancel_my_data_change(uuid) to authenticated;

-- ---------- 5) decide_request: kenali data_change_requests (khusus HR) ----------
create or replace function public.decide_request(p_table text, p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_approver uuid := current_employee_id();
  v_approver_name text;
  v_employee_id uuid;
  v_status text := case when p_approve then 'approved' else 'rejected' end;
  v_label text;
  v_absence absence_requests;
begin
  if v_approver is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
  if p_table not in ('leave_requests','overtime_requests','reimbursement_requests',
                      'shift_change_requests','absence_requests','data_change_requests') then
    raise exception 'Tabel tidak dikenali';
  end if;

  execute format('select employee_id from %I where id = $1 and status = ''pending''', p_table)
    into v_employee_id using p_request_id;

  if v_employee_id is null then
    raise exception 'Pengajuan tidak ditemukan atau sudah diproses';
  end if;

  if v_employee_id = v_approver then
    raise exception 'Anda tidak dapat menyetujui/menolak pengajuan Anda sendiri';
  end if;

  if p_table = 'data_change_requests' then
    if not is_hr() then raise exception 'Hanya HR yang dapat memproses perubahan data'; end if;
  elsif not can_decide_for(v_employee_id) then
    raise exception 'Anda tidak berwenang menyetujui/menolak pengajuan ini';
  end if;

  select full_name into v_approver_name from employees where id = v_approver;

  execute format(
    'update %I set status = $1, approver_id = $2, decided_at = now()
       where id = $3 and status = ''pending'' returning employee_id',
    p_table
  ) into v_employee_id using v_status, v_approver, p_request_id;

  if v_employee_id is null then
    raise exception 'Pengajuan tidak ditemukan atau sudah diproses';
  end if;

  if p_table = 'data_change_requests' and p_approve then
    perform public._apply_data_change(p_request_id);
  end if;

  if p_table = 'absence_requests' and p_approve then
    select * into v_absence from absence_requests where id = p_request_id;
    if v_absence.requested_clock_in is not null or v_absence.requested_clock_out is not null then
      insert into attendance (employee_id, work_date, clock_in, clock_out)
      values (
        v_absence.employee_id, v_absence.work_date,
        case when v_absence.requested_clock_in is not null then (v_absence.work_date + v_absence.requested_clock_in) else null end,
        case when v_absence.requested_clock_out is not null then (v_absence.work_date + v_absence.requested_clock_out) else null end
      )
      on conflict (employee_id, work_date) do update
        set clock_in = coalesce(excluded.clock_in, attendance.clock_in),
            clock_out = coalesce(excluded.clock_out, attendance.clock_out);
    end if;
  end if;

  if p_table = 'shift_change_requests' and p_approve then
    insert into shift_schedules (employee_id, work_date, shift_id, is_day_off)
    select sc.employee_id, sc.work_date,
           case when sc.to_is_day_off then null else sc.to_shift_id end,
           coalesce(sc.to_is_day_off, false)
    from shift_change_requests sc where sc.id = p_request_id
    on conflict (employee_id, work_date) do update
      set shift_id = excluded.shift_id, is_day_off = excluded.is_day_off;
  end if;

  v_label := case p_table
    when 'leave_requests' then 'Pengajuan cuti'
    when 'overtime_requests' then 'Pengajuan lembur'
    when 'reimbursement_requests' then 'Pengajuan reimbursement'
    when 'shift_change_requests' then 'Pengajuan ubah shift'
    when 'absence_requests' then 'Pengajuan absensi'
    when 'data_change_requests' then 'Pengajuan perubahan data'
  end;

  insert into notifications (employee_id, title, body, category, related_table, related_id, actor_name)
  values (
    v_employee_id,
    v_label || ' Anda',
    v_label || ' telah ' || (case when p_approve then 'disetujui' else 'ditolak' end),
    p_table, p_table, p_request_id, v_approver_name
  );
end;
$function$;

-- ---------- 6) get_request_detail: data_change_requests hanya untuk pemohon / HR ----------
create or replace function public.get_request_detail(p_table text, p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result json;
  v_emp uuid;
  v_apr uuid;
  v_ok boolean;
begin
  if current_employee_id() is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
  if p_table not in ('leave_requests','overtime_requests','reimbursement_requests','shift_change_requests',
                      'absence_requests','data_change_requests') then
    raise exception 'Tabel tidak dikenali';
  end if;

  execute format($f$
    select json_build_object(
      'row', row_to_json(t),
      'requester_name', emp.full_name,
      'requester_avatar', emp.avatar_url,
      'manager_name', mgr.full_name,
      'approver_name', apr.full_name
    )
    from %1$I t
    join employees emp on emp.id = t.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    left join employees apr on apr.id = t.approver_id
    where t.id = $1
  $f$, p_table)
  into v_result
  using p_id;

  if v_result is null then raise exception 'Data tidak ditemukan'; end if;

  v_emp := (v_result->'row'->>'employee_id')::uuid;
  v_apr := nullif(v_result->'row'->>'approver_id', '')::uuid;
  if p_table = 'data_change_requests' then
    v_ok := v_emp = current_employee_id() or is_hr();
  else
    v_ok := v_emp = current_employee_id() or v_apr = current_employee_id() or can_decide_for(v_emp);
  end if;
  if not v_ok then raise exception 'Data tidak ditemukan'; end if;
  return v_result;
end;
$function$;

-- ---------- 7) get_my_approvals: tambah kategori data_change_requests (HR saja) ----------
create or replace function public.get_my_approvals(p_status text default 'pending')
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_result json; v_me uuid := current_employee_id();
begin
  if v_me is null then raise exception 'Profil karyawan tidak ditemukan'; end if;

  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) into v_result from (
    select 'leave_requests' as category, lr.id, lr.employee_id, lr.created_at, lr.status,
           emp.full_name as requester_name, emp.avatar_url as requester_avatar, mgr.full_name as manager_name,
           lr.reason,
           jsonb_build_object('type_name', lt.name, 'start_date', lr.start_date, 'end_date', lr.end_date, 'total_days', lr.total_days) as details
    from leave_requests lr
    join employees emp on emp.id = lr.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    left join leave_types lt on lt.id = lr.leave_type_id
    where (p_status is null or lr.status = p_status) and can_decide_for(lr.employee_id)

    union all
    select 'overtime_requests', ot.id, ot.employee_id, ot.created_at, ot.status,
           emp.full_name, emp.avatar_url, mgr.full_name, ot.reason,
           jsonb_build_object('work_date', ot.work_date, 'start_time', ot.start_time, 'end_time', ot.end_time)
    from overtime_requests ot
    join employees emp on emp.id = ot.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    where (p_status is null or ot.status = p_status) and can_decide_for(ot.employee_id)

    union all
    select 'reimbursement_requests', rr.id, rr.employee_id, rr.created_at, rr.status,
           emp.full_name, emp.avatar_url, mgr.full_name, rr.description,
           jsonb_build_object('category_name', rc.name, 'amount', rr.amount)
    from reimbursement_requests rr
    join employees emp on emp.id = rr.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    left join reimbursement_categories rc on rc.id = rr.category_id
    where (p_status is null or rr.status = p_status) and can_decide_for(rr.employee_id)

    union all
    select 'shift_change_requests', sc.id, sc.employee_id, sc.created_at, sc.status,
           emp.full_name, emp.avatar_url, mgr.full_name, sc.reason,
           jsonb_build_object('work_date', sc.work_date, 'to_is_day_off', sc.to_is_day_off, 'to_shift_name', tsh.name,
                               'from_shift_name', fsh.name)
    from shift_change_requests sc
    join employees emp on emp.id = sc.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    left join shifts tsh on tsh.id = sc.to_shift_id
    left join shifts fsh on fsh.id = sc.from_shift_id
    where (p_status is null or sc.status = p_status) and can_decide_for(sc.employee_id)

    union all
    select 'absence_requests', ar.id, ar.employee_id, ar.created_at, ar.status,
           emp.full_name, emp.avatar_url, mgr.full_name, ar.reason,
           jsonb_build_object('work_date', ar.work_date, 'requested_clock_in', ar.requested_clock_in,
                               'requested_clock_out', ar.requested_clock_out)
    from absence_requests ar
    join employees emp on emp.id = ar.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    where (p_status is null or ar.status = p_status) and can_decide_for(ar.employee_id)

    union all
    select 'data_change_requests', dc.id, dc.employee_id, dc.created_at, dc.status,
           emp.full_name, emp.avatar_url, mgr.full_name, dc.reason,
           jsonb_build_object('field_name', dc.field_name, 'old_value', dc.old_value, 'new_value', dc.new_value)
    from data_change_requests dc
    join employees emp on emp.id = dc.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    where (p_status is null or dc.status = p_status) and is_hr()
  ) x;

  return v_result;
end;
$function$;
