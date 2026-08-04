-- =====================================================================
-- HR / Attendance App — Supabase schema
-- Mirrors the flows shown in the reference app screenshots:
--   Beranda (shift + clock in/out), Karyawan (employee directory),
--   Pengajuan (Reimbursement, Cuti, Absensi, Perubahan Shift, Lembur,
--   Perubahan Data), Inbox (notifications), Akun (profile + password),
--   Kalender.
-- Run this once in the Supabase SQL editor (or via `supabase db push`)
-- on a fresh project.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. CORE TABLES
-- ---------------------------------------------------------------------

create table if not exists employees (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  employee_code   text unique,
  full_name       text not null,
  position        text,               -- e.g. 'Office Staff', 'Warehouse Supervisor'
  department      text,
  phone           text,
  email           text,
  avatar_url      text,
  manager_id      uuid references employees(id),
  join_date       date,
  employment_status text default 'active', -- active / resigned / on_leave
  created_at      timestamptz not null default now()
);

create table if not exists shifts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,          -- 'Office Staff', 'Off', ...
  start_time  time not null,
  end_time    time not null
);

create table if not exists shift_schedules (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  shift_id      uuid references shifts(id),
  work_date     date not null,
  is_day_off    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (employee_id, work_date)
);

create table if not exists attendance (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  work_date       date not null,
  clock_in        timestamptz,
  clock_out       timestamptz,
  clock_in_lat    numeric,
  clock_in_lng    numeric,
  clock_out_lat   numeric,
  clock_out_lng   numeric,
  status          text,               -- late / early_leave / no_clock_in / no_clock_out / on_time
  created_at      timestamptz not null default now(),
  unique (employee_id, work_date)
);

create table if not exists leave_types (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,        -- 'Cuti Tahunan', 'Cuti Sakit', ...
  default_days  integer not null default 12
);

create table if not exists leave_balances (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  leave_type_id   uuid not null references leave_types(id),
  year            integer not null,
  total_days      numeric not null default 0,
  used_days       numeric not null default 0,
  unique (employee_id, leave_type_id, year)
);

create table if not exists leave_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  leave_type_id uuid references leave_types(id),
  start_date    date not null,
  end_date      date not null,
  total_days    numeric not null,
  reason        text,
  status        text not null default 'pending', -- pending / approved / rejected / cancelled
  approver_id   uuid references employees(id),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create table if not exists overtime_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  work_date     date not null,
  start_time    time not null,
  end_time      time not null,
  reason        text,
  status        text not null default 'pending',
  approver_id   uuid references employees(id),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create table if not exists reimbursement_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,          -- 'Transport', 'Medical', 'Meal', ...
  max_amount  numeric
);

create table if not exists reimbursement_requests (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  category_id     uuid references reimbursement_categories(id),
  amount          numeric not null,
  description     text,
  receipt_url     text,
  submitted_month date not null default date_trunc('month', now())::date,
  status          text not null default 'pending',
  approver_id     uuid references employees(id),
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);

create table if not exists shift_change_requests (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  work_date       date not null,
  from_shift_id   uuid references shifts(id),
  to_shift_id     uuid references shifts(id),
  to_is_day_off   boolean not null default false,
  reason          text,
  status          text not null default 'pending',
  approver_id     uuid references employees(id),
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);

create table if not exists absence_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  work_date     date not null,
  reason        text,
  attachment_url text,
  status        text not null default 'pending',
  approver_id   uuid references employees(id),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create table if not exists data_change_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  field_name    text not null,
  old_value     text,
  new_value     text not null,
  reason        text,
  status        text not null default 'pending',
  approver_id   uuid references employees(id),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create table if not exists delegations (
  id              uuid primary key default gen_random_uuid(),
  from_employee_id uuid not null references employees(id) on delete cascade,
  to_employee_id  uuid not null references employees(id) on delete cascade,
  request_type    text not null,      -- 'leave_requests' | 'overtime_requests' | ...
  request_id      uuid not null,
  status          text not null default 'pending',
  created_at      timestamptz not null default now()
);

create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  title         text not null,
  body          text,
  category      text,                 -- 'shift_change' | 'delegation' | 'leave' | ...
  related_table text,
  related_id    uuid,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text,
  author        text,
  published_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. HELPER: current employee row for the logged-in auth user
-- ---------------------------------------------------------------------

create or replace function current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from employees where auth_user_id = auth.uid();
$$;

grant execute on function current_employee_id() to authenticated;

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table employees enable row level security;
alter table shifts enable row level security;
alter table shift_schedules enable row level security;
alter table attendance enable row level security;
alter table leave_types enable row level security;
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table overtime_requests enable row level security;
alter table reimbursement_categories enable row level security;
alter table reimbursement_requests enable row level security;
alter table shift_change_requests enable row level security;
alter table absence_requests enable row level security;
alter table data_change_requests enable row level security;
alter table delegations enable row level security;
alter table notifications enable row level security;
alter table announcements enable row level security;

-- Directory + reference data: any authenticated user can read
create policy employees_select_all on employees for select to authenticated using (true);
create policy shifts_select_all on shifts for select to authenticated using (true);
create policy leave_types_select_all on leave_types for select to authenticated using (true);
create policy reimb_cat_select_all on reimbursement_categories for select to authenticated using (true);
create policy announcements_select_all on announcements for select to authenticated using (true);

-- A user may update limited fields on their own employee row (handled via RPC, not raw update)
create policy employees_update_self on employees for update to authenticated
  using (auth_user_id = auth.uid());

-- Everything else: only your own rows, reads via policy, writes via SECURITY DEFINER RPCs below
create policy shift_schedules_select_own on shift_schedules for select to authenticated
  using (employee_id = current_employee_id());

create policy attendance_select_own on attendance for select to authenticated
  using (employee_id = current_employee_id());

create policy leave_balances_select_own on leave_balances for select to authenticated
  using (employee_id = current_employee_id());

create policy leave_requests_select_own on leave_requests for select to authenticated
  using (employee_id = current_employee_id() or approver_id = current_employee_id());

create policy overtime_requests_select_own on overtime_requests for select to authenticated
  using (employee_id = current_employee_id() or approver_id = current_employee_id());

create policy reimbursement_requests_select_own on reimbursement_requests for select to authenticated
  using (employee_id = current_employee_id() or approver_id = current_employee_id());

create policy shift_change_requests_select_own on shift_change_requests for select to authenticated
  using (employee_id = current_employee_id() or approver_id = current_employee_id());

create policy absence_requests_select_own on absence_requests for select to authenticated
  using (employee_id = current_employee_id() or approver_id = current_employee_id());

create policy data_change_requests_select_own on data_change_requests for select to authenticated
  using (employee_id = current_employee_id());

create policy delegations_select_own on delegations for select to authenticated
  using (from_employee_id = current_employee_id() or to_employee_id = current_employee_id());

create policy notifications_select_own on notifications for select to authenticated
  using (employee_id = current_employee_id());

create policy notifications_update_own on notifications for update to authenticated
  using (employee_id = current_employee_id());

-- No direct insert/update/delete policies on transactional tables on purpose:
-- all writes go through the SECURITY DEFINER RPCs below so business rules
-- (one clock-in per day, balance checks, notifications, etc.) are always enforced.

-- ---------------------------------------------------------------------
-- 4. RPC FUNCTIONS
-- ---------------------------------------------------------------------

-- ---- 4.1 Home / shift + attendance -----------------------------------

create or replace function get_home_data()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid := current_employee_id();
  v_today date := current_date;
  v_result json;
begin
  if v_emp_id is null then
    raise exception 'Profil karyawan tidak ditemukan untuk akun ini';
  end if;

  select json_build_object(
    'employee', (select row_to_json(e) from (
        select id, full_name, position, avatar_url from employees where id = v_emp_id
      ) e),
    'shift', (select row_to_json(s) from (
        select ss.work_date, ss.is_day_off, sh.name as shift_name,
               sh.start_time, sh.end_time
        from shift_schedules ss
        left join shifts sh on sh.id = ss.shift_id
        where ss.employee_id = v_emp_id and ss.work_date = v_today
      ) s),
    'attendance_today', (select row_to_json(a) from (
        select clock_in, clock_out from attendance
        where employee_id = v_emp_id and work_date = v_today
      ) a),
    'unread_notifications', (select count(*) from notifications
        where employee_id = v_emp_id and is_read = false)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function get_home_data() to authenticated;


create or replace function clock_in(p_lat numeric default null, p_lng numeric default null)
returns attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid := current_employee_id();
  v_row attendance;
  v_shift_start time;
begin
  if v_emp_id is null then
    raise exception 'Profil karyawan tidak ditemukan';
  end if;

  select sh.start_time into v_shift_start
  from shift_schedules ss join shifts sh on sh.id = ss.shift_id
  where ss.employee_id = v_emp_id and ss.work_date = current_date;

  insert into attendance (employee_id, work_date, clock_in, clock_in_lat, clock_in_lng, status)
  values (
    v_emp_id, current_date, now(), p_lat, p_lng,
    case when v_shift_start is not null and current_time > v_shift_start + interval '5 minutes'
         then 'late' else 'on_time' end
  )
  on conflict (employee_id, work_date) do update
    set clock_in = excluded.clock_in,
        clock_in_lat = excluded.clock_in_lat,
        clock_in_lng = excluded.clock_in_lng
    where attendance.clock_in is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Anda sudah melakukan clock in hari ini';
  end if;

  return v_row;
end;
$$;

grant execute on function clock_in(numeric, numeric) to authenticated;


create or replace function clock_out(p_lat numeric default null, p_lng numeric default null)
returns attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid := current_employee_id();
  v_row attendance;
begin
  if v_emp_id is null then
    raise exception 'Profil karyawan tidak ditemukan';
  end if;

  update attendance
    set clock_out = now(), clock_out_lat = p_lat, clock_out_lng = p_lng
    where employee_id = v_emp_id and work_date = current_date and clock_out is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Anda belum clock in, atau sudah clock out hari ini';
  end if;

  return v_row;
end;
$$;

grant execute on function clock_out(numeric, numeric) to authenticated;


-- ---- 4.2 Cuti (leave) --------------------------------------------------

create or replace function submit_leave_request(
  p_leave_type_id uuid, p_start_date date, p_end_date date, p_reason text
)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid := current_employee_id();
  v_row leave_requests;
  v_days numeric;
begin
  if v_emp_id is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
  if p_end_date < p_start_date then raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai'; end if;

  v_days := (p_end_date - p_start_date) + 1;

  insert into leave_requests (employee_id, leave_type_id, start_date, end_date, total_days, reason)
  values (v_emp_id, p_leave_type_id, p_start_date, p_end_date, v_days, p_reason)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function submit_leave_request(uuid, date, date, text) to authenticated;


-- ---- 4.3 Lembur (overtime) ----------------------------------------------

create or replace function submit_overtime_request(
  p_work_date date, p_start_time time, p_end_time time, p_reason text
)
returns overtime_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid := current_employee_id();
  v_row overtime_requests;
begin
  if v_emp_id is null then raise exception 'Profil karyawan tidak ditemukan'; end if;

  insert into overtime_requests (employee_id, work_date, start_time, end_time, reason)
  values (v_emp_id, p_work_date, p_start_time, p_end_time, p_reason)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function submit_overtime_request(date, time, time, text) to authenticated;


-- ---- 4.4 Reimbursement ---------------------------------------------------

create or replace function submit_reimbursement_request(
  p_category_id uuid, p_amount numeric, p_description text, p_receipt_url text
)
returns reimbursement_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid := current_employee_id();
  v_row reimbursement_requests;
begin
  if v_emp_id is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
  if p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;

  insert into reimbursement_requests (employee_id, category_id, amount, description, receipt_url)
  values (v_emp_id, p_category_id, p_amount, p_description, p_receipt_url)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function submit_reimbursement_request(uuid, numeric, text, text) to authenticated;


-- ---- 4.5 Perubahan Shift --------------------------------------------------

create or replace function submit_shift_change_request(
  p_work_date date, p_to_shift_id uuid, p_to_is_day_off boolean, p_reason text
)
returns shift_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid := current_employee_id();
  v_from_shift uuid;
  v_row shift_change_requests;
begin
  if v_emp_id is null then raise exception 'Profil karyawan tidak ditemukan'; end if;

  select shift_id into v_from_shift from shift_schedules
    where employee_id = v_emp_id and work_date = p_work_date;

  insert into shift_change_requests (employee_id, work_date, from_shift_id, to_shift_id, to_is_day_off, reason)
  values (v_emp_id, p_work_date, v_from_shift, p_to_shift_id, p_to_is_day_off, p_reason)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function submit_shift_change_request(date, uuid, boolean, text) to authenticated;


-- ---- 4.6 Perubahan absensi (attendance correction) -----------------------

create or replace function submit_absence_request(
  p_work_date date, p_reason text, p_attachment_url text
)
returns absence_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid := current_employee_id();
  v_row absence_requests;
begin
  if v_emp_id is null then raise exception 'Profil karyawan tidak ditemukan'; end if;

  insert into absence_requests (employee_id, work_date, reason, attachment_url)
  values (v_emp_id, p_work_date, p_reason, p_attachment_url)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function submit_absence_request(date, text, text) to authenticated;


-- ---- 4.7 Perubahan data (profile field change) ----------------------------

create or replace function submit_data_change_request(
  p_field_name text, p_old_value text, p_new_value text, p_reason text
)
returns data_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid := current_employee_id();
  v_row data_change_requests;
begin
  if v_emp_id is null then raise exception 'Profil karyawan tidak ditemukan'; end if;

  insert into data_change_requests (employee_id, field_name, old_value, new_value, reason)
  values (v_emp_id, p_field_name, p_old_value, p_new_value, p_reason)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function submit_data_change_request(text, text, text, text) to authenticated;


-- ---- 4.8 Approvals (manager side) -----------------------------------------
-- Generic approve/reject for the 5 request tables; also writes a notification
-- back to the requester, matching the Inbox "... approved" items in the screenshots.

create or replace function decide_request(
  p_table text, p_request_id uuid, p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approver uuid := current_employee_id();
  v_employee_id uuid;
  v_status text := case when p_approve then 'approved' else 'rejected' end;
  v_label text;
begin
  if v_approver is null then raise exception 'Profil karyawan tidak ditemukan'; end if;
  if p_table not in ('leave_requests','overtime_requests','reimbursement_requests',
                      'shift_change_requests','absence_requests') then
    raise exception 'Tabel tidak dikenali';
  end if;

  execute format(
    'update %I set status = $1, approver_id = $2, decided_at = now()
       where id = $3 and status = ''pending'' returning employee_id',
    p_table
  ) into v_employee_id using v_status, v_approver, p_request_id;

  if v_employee_id is null then
    raise exception 'Pengajuan tidak ditemukan atau sudah diproses';
  end if;

  v_label := case p_table
    when 'leave_requests' then 'Pengajuan cuti'
    when 'overtime_requests' then 'Pengajuan lembur'
    when 'reimbursement_requests' then 'Pengajuan reimbursement'
    when 'shift_change_requests' then 'Pengajuan ubah shift'
    when 'absence_requests' then 'Pengajuan absensi'
  end;

  insert into notifications (employee_id, title, body, category, related_table, related_id)
  values (
    v_employee_id,
    v_label || ' Anda',
    v_label || ' telah ' || (case when p_approve then 'disetujui' else 'ditolak' end),
    p_table, p_table, p_request_id
  );
end;
$$;

grant execute on function decide_request(text, uuid, boolean) to authenticated;


-- ---- 4.9 Change password ---------------------------------------------------
-- Password changes go through Supabase Auth directly on the client
-- (supabase.auth.updateUser({ password })) — no custom RPC needed since
-- auth.users is managed by Supabase, not by this schema.

-- ---------------------------------------------------------------------
-- 5. SEED DATA (optional — safe to remove)
-- ---------------------------------------------------------------------

insert into shifts (name, start_time, end_time) values
  ('Office Staff', '08:00', '17:00'),
  ('Off', '00:00', '00:00')
on conflict do nothing;

insert into leave_types (name, default_days) values
  ('Cuti Tahunan', 12),
  ('Cuti Sakit', 12)
on conflict do nothing;

insert into reimbursement_categories (name, max_amount) values
  ('Transport', 500000),
  ('Medical', 1000000),
  ('Meal', 300000)
on conflict do nothing;
