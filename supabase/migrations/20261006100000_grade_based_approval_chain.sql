-- =====================================================================
-- RANTAI PERSETUJUAN BERDASARKAN GOLONGAN (berurutan)
--
--   golongan 1 -> atasan golongan 2, lalu atasannya golongan 3
--   golongan 2 -> golongan 3
--   golongan 3 -> golongan 4, lalu golongan 5
--   (tambahan) golongan 4 -> golongan 5 ; golongan 5 -> golongan 5 ; tanpa atasan (CEO) -> HR
--
-- Rantai ditelusuri ke ATAS lewat manager_id. Tingkat yang tidak ada di rantai dilewati (di data nyata, 63 karyawan
-- gol. 1 langsung melapor ke gol. 3). Bila tidak ada tingkat yang cocok: atasan terdekat yang golongannya lebih tinggi;
-- bila tidak ada atasan sama sekali: HR. Tahap berikutnya baru aktif setelah tahap sebelumnya menyetujui; penolakan di
-- tahap mana pun langsung menolak pengajuan. HR dapat meng-override (bisa dimatikan lewat approval_settings), karena
-- saat ini hanya sebagian kecil atasan yang sudah punya akun login.
-- Berlaku untuk: cuti, lembur, reimbursement, ubah shift, koreksi presensi. Perubahan Data tetap khusus HR.
-- =====================================================================

-- ---------- 1) Aturan (data, mudah diubah) & pengaturan ----------
create table if not exists public.approval_rules (
  requester_grade smallint not null,
  step_no         smallint not null,
  approver_grade  smallint not null,
  primary key (requester_grade, step_no)
);
insert into public.approval_rules (requester_grade, step_no, approver_grade) values
  (1,1,2),(1,2,3),(2,1,3),(3,1,4),(3,2,5),(4,1,5),(5,1,5)
on conflict do nothing;

create table if not exists public.approval_settings (
  id          boolean primary key default true check (id),
  hr_override boolean not null default true
);
insert into public.approval_settings (id) values (true) on conflict do nothing;

create table if not exists public.approval_steps (
  id             uuid primary key default gen_random_uuid(),
  table_name     text not null check (table_name in ('leave_requests','overtime_requests','reimbursement_requests','shift_change_requests','absence_requests')),
  request_id     uuid not null,
  employee_id    uuid not null references public.employees(id) on delete cascade,   -- pemohon
  step_no        int  not null,
  required_grade smallint,                                                           -- null = tahap cadangan (bukan dari aturan)
  approver_id    uuid references public.employees(id) on delete set null,           -- null = HR (cadangan)
  status         text not null default 'pending' check (status in ('pending','approved','rejected','skipped')),
  decided_by     uuid references public.employees(id) on delete set null,
  decided_at     timestamptz,
  acted_as_hr    boolean not null default false,                                     -- diputuskan HR di luar approver yang ditunjuk
  created_at     timestamptz not null default now(),
  unique (table_name, request_id, step_no)
);
create index if not exists approval_steps_approver on public.approval_steps (approver_id, status);
create index if not exists approval_steps_employee on public.approval_steps (employee_id);

alter table public.approval_rules    enable row level security;
alter table public.approval_settings enable row level security;
alter table public.approval_steps    enable row level security;
revoke all on public.approval_rules, public.approval_settings, public.approval_steps from anon, authenticated;

-- ---------- 2) Penentuan rantai ----------
create or replace function public._resolve_approval_chain(p_employee uuid)
returns table (o_step int, o_grade smallint, o_approver uuid)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_grade smallint; v_cur uuid;
  v_anc uuid[] := '{}'; v_ancg smallint[] := '{}';
  v_seen uuid[] := array[p_employee];
  v_depth int := 0; v_mgr uuid; v_mg smallint; v_active boolean;
  r record; i int; v_last int := 0; v_n int := 0; v_len int;
begin
  select grade, manager_id into v_grade, v_cur from employees where id = p_employee;

  -- telusuri atasan ke atas (maks 12 tingkat, tahan siklus); hanya karyawan aktif yang dihitung
  while v_cur is not null and v_depth < 12 and not (v_cur = any (v_seen)) loop
    select e.manager_id, e.grade, (e.employment_status = 'active') into v_mgr, v_mg, v_active from employees e where e.id = v_cur;
    exit when not found;
    v_seen := v_seen || v_cur;
    if v_active then v_anc := v_anc || v_cur; v_ancg := v_ancg || v_mg; end if;
    v_cur := v_mgr; v_depth := v_depth + 1;
  end loop;
  v_len := coalesce(array_length(v_anc, 1), 0);

  -- terapkan aturan golongan secara berurutan; tingkat yang tidak ada di rantai dilewati
  for r in select ar.approver_grade from approval_rules ar where ar.requester_grade = v_grade order by ar.step_no loop
    for i in v_last + 1 .. v_len loop
      if v_ancg[i] = r.approver_grade then
        v_n := v_n + 1; o_step := v_n; o_grade := r.approver_grade; o_approver := v_anc[i]; return next;
        v_last := i; exit;
      end if;
    end loop;
  end loop;

  -- cadangan 1: atasan terdekat yang golongannya lebih tinggi
  if v_n = 0 then
    for i in 1 .. v_len loop
      if v_grade is null or (v_ancg[i] is not null and v_ancg[i] > v_grade) then
        v_n := 1; o_step := 1; o_grade := null; o_approver := v_anc[i]; return next; exit;
      end if;
    end loop;
  end if;

  -- cadangan 2: tidak ada atasan yang sesuai (mis. CEO) => HR
  if v_n = 0 then
    o_step := 1; o_grade := null; o_approver := null; return next;
  end if;
  return;
end $$;

create or replace function public._step_recipients(p_approver uuid)
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select id from employees where p_approver is null and role in ('hr','admin')
  union
  select p_approver where p_approver is not null
  union   -- approver belum punya akun login: beri tahu HR agar dapat menindaklanjuti
  select id from employees where p_approver is not null and role in ('hr','admin')
     and not exists (select 1 from employees a where a.id = p_approver and a.auth_user_id is not null)
$$;

-- ---------- 3) Trigger: buat tahapan saat pengajuan dibuat; tutup sisa tahapan saat pengajuan selesai/dibatalkan ----------
create or replace function public._trg_create_approval_steps()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into approval_steps (table_name, request_id, employee_id, step_no, required_grade, approver_id)
  select tg_table_name, new.id, new.employee_id, c.o_step, c.o_grade, c.o_approver
    from public._resolve_approval_chain(new.employee_id) c;
  return new;
end $$;

create or replace function public._trg_close_approval_steps()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if old.status = 'pending' and new.status is distinct from 'pending' then
    update approval_steps set status = 'skipped'
     where table_name = tg_table_name and request_id = new.id and status = 'pending';
  end if;
  return new;
end $$;

do $do$
declare t text;
begin
  foreach t in array array['leave_requests','overtime_requests','reimbursement_requests','shift_change_requests','absence_requests'] loop
    execute format('drop trigger if exists trg_approval_steps_create on public.%I', t);
    execute format('create trigger trg_approval_steps_create after insert on public.%I for each row execute function public._trg_create_approval_steps()', t);
    execute format('drop trigger if exists trg_approval_steps_close on public.%I', t);
    execute format('create trigger trg_approval_steps_close after update of status on public.%I for each row execute function public._trg_close_approval_steps()', t);
  end loop;
end $do$;

-- ---------- 4) Visibilitas & hak bertindak ----------
-- "Boleh melihat": peserta rantai yang gilirannya sudah tiba / sudah memutuskan, atau HR. Approver tahap berikutnya
-- baru melihat pengajuan saat gilirannya tiba. "Boleh bertindak": hanya approver tahap AKTIF (atau HR bila override aktif).
create or replace function public._approval_visible(p_table text, p_request_id uuid, p_employee_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_me uuid := current_employee_id();
begin
  if v_me is null then return false; end if;
  if not exists (select 1 from approval_steps where table_name = p_table and request_id = p_request_id) then
    return can_decide_for(p_employee_id);                    -- pengajuan lama (tanpa tahapan): aturan lama
  end if;
  if is_hr() then return true; end if;
  return exists (
    select 1 from approval_steps s
     where s.table_name = p_table and s.request_id = p_request_id
       and (s.decided_by = v_me
            or (s.approver_id = v_me and (
                  s.status in ('approved','rejected')
                  or (s.status = 'pending' and s.step_no = (select min(x.step_no) from approval_steps x
                        where x.table_name = p_table and x.request_id = p_request_id and x.status = 'pending')))))
  );
end $$;

create or replace function public._approval_can_act(p_table text, p_request_id uuid, p_employee_id uuid, p_status text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_me uuid := current_employee_id(); v_override boolean;
begin
  if v_me is null or p_status is distinct from 'pending' or p_employee_id = v_me then return false; end if;
  if not exists (select 1 from approval_steps where table_name = p_table and request_id = p_request_id) then
    return can_decide_for(p_employee_id);
  end if;
  select hr_override into v_override from approval_settings limit 1;
  return exists (
    select 1 from approval_steps s
     where s.table_name = p_table and s.request_id = p_request_id and s.status = 'pending'
       and s.step_no = (select min(x.step_no) from approval_steps x where x.table_name = p_table and x.request_id = p_request_id and x.status = 'pending')
       and (s.approver_id = v_me or (is_hr() and (s.approver_id is null or coalesce(v_override, true))))
  );
end $$;

create or replace function public._approval_waiting_name(p_table text, p_request_id uuid, p_status text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(a.full_name, 'HR')
    from approval_steps s left join employees a on a.id = s.approver_id
   where p_status = 'pending' and s.table_name = p_table and s.request_id = p_request_id and s.status = 'pending'
   order by s.step_no limit 1
$$;

-- ---------- 5) Notifikasi pengajuan baru: ke approver tahap aktif (HR hanya bila approver belum punya akun) ----------
create or replace function public.notify_new_request(p_requester_id uuid, p_title text, p_body text, p_table text, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_manager_id uuid; v_requester_name text; v_recipient_id uuid; v_step approval_steps;
begin
  select manager_id, full_name into v_manager_id, v_requester_name from employees where id = p_requester_id;
  select * into v_step from approval_steps
   where table_name = p_table and request_id = p_request_id and status = 'pending' order by step_no limit 1;

  if v_step.id is not null then
    for v_recipient_id in select public._step_recipients(v_step.approver_id) loop
      if v_recipient_id <> p_requester_id then
        insert into notifications (employee_id, title, body, category, related_table, related_id, actor_name)
        values (v_recipient_id, p_title, p_body, 'approval', p_table, p_request_id, v_requester_name);
      end if;
    end loop;
  else   -- pengajuan tanpa tahapan: perilaku lama
    for v_recipient_id in
      select id from employees where id = v_manager_id or role in ('hr', 'admin') group by id
    loop
      if v_recipient_id <> p_requester_id then
        insert into notifications (employee_id, title, body, category, related_table, related_id, actor_name)
        values (v_recipient_id, p_title, p_body, 'approval', p_table, p_request_id, v_requester_name);
      end if;
    end loop;
  end if;
end;
$function$;

-- ---------- 6) decide_request: tahapan berurutan ----------
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
  v_step approval_steps;
  v_next approval_steps;
  v_override boolean;
  v_override_act boolean := false;
  v_final boolean := true;
  v_wname text; v_wgrade smallint; v_nname text; v_rec uuid;
begin
  if v_approver is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
  if p_table not in ('leave_requests','overtime_requests','reimbursement_requests',
                      'shift_change_requests','absence_requests','data_change_requests') then
    raise exception 'Tabel tidak dikenali';
  end if;

  execute format('select employee_id from %I where id = $1 and status = ''pending'' for update', p_table)
    into v_employee_id using p_request_id;
  if v_employee_id is null then
    raise exception 'Pengajuan tidak ditemukan atau sudah diproses';
  end if;
  if v_employee_id = v_approver then
    raise exception 'Anda tidak dapat menyetujui/menolak pengajuan Anda sendiri';
  end if;

  select full_name into v_approver_name from employees where id = v_approver;
  v_label := case p_table
    when 'leave_requests' then 'Pengajuan cuti'
    when 'overtime_requests' then 'Pengajuan lembur'
    when 'reimbursement_requests' then 'Pengajuan reimbursement'
    when 'shift_change_requests' then 'Pengajuan ubah shift'
    when 'absence_requests' then 'Pengajuan absensi'
    when 'data_change_requests' then 'Pengajuan perubahan data'
  end;

  if p_table = 'data_change_requests' then
    if not is_hr() then raise exception 'Hanya HR yang dapat memproses perubahan data'; end if;
  else
    select * into v_step from approval_steps
     where table_name = p_table and request_id = p_request_id and status = 'pending' order by step_no limit 1;

    if v_step.id is null then
      -- pengajuan lama tanpa tahapan: aturan lama (atasan langsung / HR)
      if not can_decide_for(v_employee_id) then
        raise exception 'Anda tidak berwenang menyetujui/menolak pengajuan ini';
      end if;
    else
      select hr_override into v_override from approval_settings limit 1;
      v_override_act := v_step.approver_id is distinct from v_approver;
      if v_override_act and not (is_hr() and (v_step.approver_id is null or coalesce(v_override, true))) then
        select full_name, grade into v_wname, v_wgrade from employees where id = v_step.approver_id;
        raise exception 'Pengajuan ini menunggu persetujuan % (golongan %). Anda tidak berwenang pada tahap ini.',
          coalesce(v_wname, 'HR'), coalesce(v_wgrade::text, '-');
      end if;

      if not p_approve then
        update approval_steps set status = 'rejected', decided_by = v_approver, decided_at = now(), acted_as_hr = v_override_act
         where id = v_step.id;
        update approval_steps set status = 'skipped'
         where table_name = p_table and request_id = p_request_id and status = 'pending';
      elsif v_override_act then
        -- HR meng-override: menyelesaikan seluruh sisa tahapan sekaligus (tercatat sebagai tindakan HR)
        update approval_steps set status = 'approved', decided_by = v_approver, decided_at = now(), acted_as_hr = true
         where table_name = p_table and request_id = p_request_id and status = 'pending';
      else
        update approval_steps set status = 'approved', decided_by = v_approver, decided_at = now(), acted_as_hr = false
         where id = v_step.id;
        v_final := not exists (select 1 from approval_steps
                                where table_name = p_table and request_id = p_request_id and status = 'pending');
      end if;
    end if;
  end if;

  if not v_final then
    -- masih ada tahap berikutnya: beri tahu approver berikutnya dan pemohon, pengajuan tetap 'pending'
    select * into v_next from approval_steps
     where table_name = p_table and request_id = p_request_id and status = 'pending' order by step_no limit 1;
    select full_name into v_nname from employees where id = v_next.approver_id;
    insert into notifications (employee_id, title, body, category, related_table, related_id, actor_name)
    values (v_employee_id, v_label || ' Anda',
            'Disetujui oleh ' || coalesce(v_approver_name, '-') || ', menunggu persetujuan ' || coalesce(v_nname, 'HR'),
            p_table, p_table, p_request_id, v_approver_name);
    for v_rec in select public._step_recipients(v_next.approver_id) loop
      insert into notifications (employee_id, title, body, category, related_table, related_id, actor_name)
      select v_rec, v_label || ' menunggu persetujuan Anda', 'Sudah disetujui ' || coalesce(v_approver_name, '-'),
             'approval', p_table, p_request_id, (select full_name from employees where id = v_employee_id);
    end loop;
    return;
  end if;

  -- final: terapkan keputusan pada pengajuan
  execute format(
    'update %I set status = $1, approver_id = $2, decided_at = now()
       where id = $3 and status = ''pending'' returning employee_id', p_table
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

  insert into notifications (employee_id, title, body, category, related_table, related_id, actor_name)
  values (
    v_employee_id,
    v_label || ' Anda',
    v_label || ' telah ' || (case when p_approve then 'disetujui' else 'ditolak' end),
    p_table, p_table, p_request_id, v_approver_name
  );
end;
$function$;

-- ---------- 7) get_request_detail: otorisasi berbasis tahapan + daftar tahapan untuk linimasa ----------
create or replace function public.get_request_detail(p_table text, p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result json; v_emp uuid; v_apr uuid; v_ok boolean; v_steps json;
  v_me uuid := current_employee_id(); v_has_steps boolean;
begin
  if v_me is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
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
  select exists (select 1 from approval_steps where table_name = p_table and request_id = p_id) into v_has_steps;

  if p_table = 'data_change_requests' then
    v_ok := v_emp = v_me or is_hr();
  elsif v_has_steps then
    v_ok := v_emp = v_me or is_hr() or exists (
      select 1 from approval_steps s where s.table_name = p_table and s.request_id = p_id
         and (s.approver_id = v_me or s.decided_by = v_me));
  else
    v_ok := v_emp = v_me or v_apr = v_me or can_decide_for(v_emp);
  end if;
  if not v_ok then raise exception 'Data tidak ditemukan'; end if;

  if v_has_steps then
    select coalesce(json_agg(json_build_object(
             'step_no', s.step_no, 'status', s.status, 'required_grade', s.required_grade,
             'approver_name', a.full_name, 'approver_position', a."position", 'approver_grade', a.grade,
             'decided_by_name', d.full_name, 'decided_at', s.decided_at,
             'acted_as_hr', s.acted_as_hr, 'hr_fallback', s.approver_id is null) order by s.step_no), '[]'::json)
      into v_steps
      from approval_steps s
      left join employees a on a.id = s.approver_id
      left join employees d on d.id = s.decided_by
     where s.table_name = p_table and s.request_id = p_id;
    v_result := (v_result::jsonb || jsonb_build_object('steps', v_steps::jsonb))::json;
  end if;
  v_result := (v_result::jsonb || jsonb_build_object('can_act',
      case when p_table = 'data_change_requests' then (v_result->'row'->>'status') = 'pending' and is_hr()
           else public._approval_can_act(p_table, p_id, v_emp, v_result->'row'->>'status') end))::json;
  return v_result;
end;
$function$;

-- ---------- 8) get_my_approvals: antrean mengikuti tahap aktif ----------
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
           jsonb_build_object('type_name', lt.name, 'start_date', lr.start_date, 'end_date', lr.end_date, 'total_days', lr.total_days) as details, public._approval_can_act('leave_requests', lr.id, lr.employee_id, lr.status) as can_act, public._approval_waiting_name('leave_requests', lr.id, lr.status) as waiting_for
    from leave_requests lr
    join employees emp on emp.id = lr.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    left join leave_types lt on lt.id = lr.leave_type_id
    where (p_status is null or lr.status = p_status) and public._approval_visible('leave_requests', lr.id, lr.employee_id)

    union all
    select 'overtime_requests', ot.id, ot.employee_id, ot.created_at, ot.status,
           emp.full_name, emp.avatar_url, mgr.full_name, ot.reason,
           jsonb_build_object('work_date', ot.work_date, 'start_time', ot.start_time, 'end_time', ot.end_time), public._approval_can_act('overtime_requests', ot.id, ot.employee_id, ot.status) as can_act, public._approval_waiting_name('overtime_requests', ot.id, ot.status) as waiting_for
    from overtime_requests ot
    join employees emp on emp.id = ot.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    where (p_status is null or ot.status = p_status) and public._approval_visible('overtime_requests', ot.id, ot.employee_id)

    union all
    select 'reimbursement_requests', rr.id, rr.employee_id, rr.created_at, rr.status,
           emp.full_name, emp.avatar_url, mgr.full_name, rr.description,
           jsonb_build_object('category_name', rc.name, 'amount', rr.amount), public._approval_can_act('reimbursement_requests', rr.id, rr.employee_id, rr.status) as can_act, public._approval_waiting_name('reimbursement_requests', rr.id, rr.status) as waiting_for
    from reimbursement_requests rr
    join employees emp on emp.id = rr.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    left join reimbursement_categories rc on rc.id = rr.category_id
    where (p_status is null or rr.status = p_status) and public._approval_visible('reimbursement_requests', rr.id, rr.employee_id)

    union all
    select 'shift_change_requests', sc.id, sc.employee_id, sc.created_at, sc.status,
           emp.full_name, emp.avatar_url, mgr.full_name, sc.reason,
           jsonb_build_object('work_date', sc.work_date, 'to_is_day_off', sc.to_is_day_off, 'to_shift_name', tsh.name,
                               'from_shift_name', fsh.name), public._approval_can_act('shift_change_requests', sc.id, sc.employee_id, sc.status) as can_act, public._approval_waiting_name('shift_change_requests', sc.id, sc.status) as waiting_for
    from shift_change_requests sc
    join employees emp on emp.id = sc.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    left join shifts tsh on tsh.id = sc.to_shift_id
    left join shifts fsh on fsh.id = sc.from_shift_id
    where (p_status is null or sc.status = p_status) and public._approval_visible('shift_change_requests', sc.id, sc.employee_id)

    union all
    select 'absence_requests', ar.id, ar.employee_id, ar.created_at, ar.status,
           emp.full_name, emp.avatar_url, mgr.full_name, ar.reason,
           jsonb_build_object('work_date', ar.work_date, 'requested_clock_in', ar.requested_clock_in,
                               'requested_clock_out', ar.requested_clock_out), public._approval_can_act('absence_requests', ar.id, ar.employee_id, ar.status) as can_act, public._approval_waiting_name('absence_requests', ar.id, ar.status) as waiting_for
    from absence_requests ar
    join employees emp on emp.id = ar.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    where (p_status is null or ar.status = p_status) and public._approval_visible('absence_requests', ar.id, ar.employee_id)

    union all
    select 'data_change_requests', dc.id, dc.employee_id, dc.created_at, dc.status,
           emp.full_name, emp.avatar_url, mgr.full_name, dc.reason,
           jsonb_build_object('field_name', dc.field_name, 'old_value', dc.old_value, 'new_value', dc.new_value), (dc.status = 'pending' and is_hr()) as can_act, case when dc.status = 'pending' then 'HR' end as waiting_for
    from data_change_requests dc
    join employees emp on emp.id = dc.employee_id
    left join employees mgr on mgr.id = emp.manager_id
    where (p_status is null or dc.status = p_status) and is_hr()
  ) x;

  return v_result;
end;
$function$;

create or replace function public.get_approval_counts()
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_all json;
begin
  select get_my_approvals('pending') into v_all;
  return (
    select json_object_agg(category, cnt) from (
      select category, count(*) as cnt
        from json_to_recordset(v_all) as x(category text, can_act boolean)
       where can_act
       group by category
    ) c
  );
end;
$function$;

-- ---------- 9) Progres tahapan (untuk daftar HR dan pemohon) ----------
create or replace function public.get_approval_progress(p_table text, p_ids uuid[])
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_me uuid := current_employee_id();
begin
  if v_me is null then return '[]'::json; end if;
  return (
    select coalesce(json_agg(x), '[]'::json) from (
      select s.request_id,
             count(*)::int as total,
             (count(*) filter (where s.status = 'approved'))::int as approved,
             w.step_no as waiting_step,
             wa.full_name as waiting_name, wa.grade as waiting_grade, wa."position" as waiting_position,
             (w.id is not null and w.approver_id is null) as waiting_hr
        from approval_steps s
        left join lateral (
          select w0.* from approval_steps w0
           where w0.table_name = s.table_name and w0.request_id = s.request_id and w0.status = 'pending'
           order by w0.step_no limit 1) w on true
        left join employees wa on wa.id = w.approver_id
       where s.table_name = p_table and s.request_id = any (p_ids)
         and (is_hr() or s.employee_id = v_me)
       group by s.request_id, w.id, w.step_no, wa.full_name, wa.grade, wa."position", w.approver_id
    ) x
  );
end $$;

-- ---------- 10) Alat HR: pratinjau rantai & pengaturan override ----------
create or replace function public.preview_approval_chain(p_employee_id uuid)
returns table (step_no int, required_grade smallint, approver_code text, approver_name text, approver_grade smallint, approver_position text, has_account boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not is_hr() then raise exception 'Akses khusus HR'; end if;
  return query
    select c.o_step, c.o_grade, a.employee_code, coalesce(a.full_name, 'HR'), a.grade, a."position", (a.auth_user_id is not null)
      from public._resolve_approval_chain(p_employee_id) c
      left join employees a on a.id = c.o_approver
     order by c.o_step;
end $$;

create or replace function public.get_approval_settings()
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not is_hr() then raise exception 'Akses khusus HR'; end if;
  return (select json_build_object('hr_override', hr_override) from approval_settings limit 1);
end $$;

create or replace function public.set_approval_hr_override(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_hr() then raise exception 'Akses khusus HR'; end if;
  update approval_settings set hr_override = coalesce(p_enabled, true);
end $$;

revoke execute on function public._resolve_approval_chain(uuid) from public, anon, authenticated;
revoke execute on function public._step_recipients(uuid) from public, anon, authenticated;
revoke execute on function public._approval_visible(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._approval_can_act(text, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public._approval_waiting_name(text, uuid, text) from public, anon, authenticated;
revoke execute on function public._trg_create_approval_steps() from public, anon, authenticated;
revoke execute on function public._trg_close_approval_steps() from public, anon, authenticated;
revoke execute on function public.get_approval_progress(text, uuid[]) from public, anon;
revoke execute on function public.preview_approval_chain(uuid) from public, anon;
revoke execute on function public.get_approval_settings() from public, anon;
revoke execute on function public.set_approval_hr_override(boolean) from public, anon;
grant  execute on function public.get_approval_progress(text, uuid[]) to authenticated;
grant  execute on function public.preview_approval_chain(uuid) to authenticated;
grant  execute on function public.get_approval_settings() to authenticated;
grant  execute on function public.set_approval_hr_override(boolean) to authenticated;
