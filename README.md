# HR App (clone UI Mekari Talenta-style) — Supabase + React

Aplikasi HR sederhana (Beranda/Clock In-Out, Karyawan, Cuti, Lembur, Reimbursement,
Absensi, Perubahan Shift, Perubahan Data, Inbox, Kalender, Ubah Kata Sandi) dengan
Supabase sebagai backend & database, dibuat mengikuti tampilan pada gambar yang Anda
kirim.

## 1. Buat project Supabase

1. Buka https://supabase.com → buat project baru (gratis).
2. Catat **Project URL** dan **anon public key** (Settings → API).
3. Buka **SQL Editor** di dashboard Supabase, buka file `supabase/schema.sql` di
   folder ini, copy semua isinya, paste ke SQL Editor, lalu klik **Run**.
   Ini akan membuat semua tabel, RLS (Row Level Security), dan fungsi (RPC)
   yang dipakai aplikasi (clock in/out, ajukan cuti, lembur, reimbursement, dst).

## 2. Buat akun login pertama Anda

Supabase Auth mengelola login (email + password) secara terpisah dari tabel
`employees` yang menyimpan data karyawan. Keduanya dihubungkan lewat kolom
`employees.auth_user_id`.

1. Di dashboard Supabase → **Authentication → Users → Add user**, buat user
   dengan email & password Anda (centang "Auto confirm user").
2. Copy **User UID** yang muncul.
3. Di **SQL Editor**, jalankan (ganti nilai sesuai Anda):
   ```sql
   insert into employees (auth_user_id, employee_code, full_name, position, department)
   values ('PASTE-USER-UID-DI-SINI', 'EMP001', 'Nama Anda', 'Office Staff', 'Office');
   ```
4. (Opsional) beri diri Anda jadwal shift hari ini supaya kartu shift di Beranda terisi:
   ```sql
   insert into shift_schedules (employee_id, shift_id, work_date)
   select e.id, s.id, current_date
   from employees e, shifts s
   where e.employee_code = 'EMP001' and s.name = 'Office Staff';
   ```

Ulangi langkah di atas untuk menambah karyawan lain ke tabel `employees`
(kolom `auth_user_id` boleh NULL kalau karyawan itu belum perlu login sendiri —
tetap akan muncul di daftar Karyawan).

## 3. Jalankan aplikasi di komputer Anda

Butuh [Node.js](https://nodejs.org) (versi 18 ke atas) terpasang.

```bash
cd hr-app
cp .env.example .env
# lalu buka file .env, isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
# dengan nilai dari langkah 1

npm install
npm run dev
```

Buka alamat yang muncul di terminal (biasanya `http://localhost:5173`) di
browser HP atau desktop, lalu login dengan email/password yang dibuat di
langkah 2.

## 4. Struktur proyek

```
supabase/schema.sql     -> semua tabel, RLS, dan fungsi backend (RPC)
src/lib/supabaseClient.js -> koneksi ke Supabase
src/lib/useAuth.js       -> status login + data karyawan yang sedang login
src/lib/menuConfig.js    -> daftar menu (quick grid, semua aplikasi, ajukan untuk)
src/components/          -> BottomNav, Sheet (bottom sheet), AllAppsSheet, RequestSheet
src/pages/                -> satu file per halaman (Home, Employees, Inbox, Account,
                              Reimbursement, Cuti, Lembur, Absensi, ShiftChangeForm,
                              DataChangeForm, CalendarPage, Login)
```

## 5. Fitur yang sudah berfungsi penuh (terhubung ke Supabase)

- Login/logout, ubah kata sandi (Supabase Auth)
- Beranda: kartu jadwal shift hari ini. Clock In / Clock Out sekarang membuka
  kamera depan untuk foto selfie (disimpan ke Supabase Storage bucket
  `attendance-photos`) sekaligus merekam lokasi GPS — keduanya wajib diizinkan
  browser saat pertama kali dipakai. Status "berhasil clock in pukul ..."
  menampilkan koordinat lokasi dan link ke foto yang diambil.
  Catatan: akses kamera browser (`getUserMedia`) hanya jalan di `localhost`
  atau alamat **HTTPS** — kalau nanti di-deploy ke domain sendiri, pastikan
  pakai HTTPS (Vercel/Netlify otomatis HTTPS).
- Karyawan: daftar & pencarian nama (tabel `employees`)
- Pengajuan: Cuti, Lembur, Reimbursement, Absensi, Perubahan Shift, Perubahan
  Data — masing-masing punya daftar riwayat + form pengajuan baru yang
  menyimpan ke Supabase lewat fungsi RPC (`submit_leave_request`,
  `submit_overtime_request`, dst.)
- Daftar Absensi: tab Riwayat (ringkasan absensi bulan berjalan), Absensi
  (riwayat pengajuan koreksi absensi), Shift (riwayat pengajuan ubah shift)
- Inbox: tab Notifikasi (terisi otomatis saat pengajuan disetujui/ditolak
  lewat fungsi `decide_request`) dan tab Butuh Persetujuan
- Kalender: tampilan bulan + titik penanda tanggal yang ada cuti
- Semua Aplikasi & Ajukan Untuk: bottom sheet sesuai gambar

## 6. Yang masih placeholder ("segera hadir")

Menu seperti Slip Gaji, File, Review, Aset, Formulir, Goal, Timesheet,
Peringatan, Proyek, Tugas, dan detail Info Personal/Payroll/dll di halaman
Akun ditampilkan di UI (grid/menu) tapi belum punya tabel & fungsi backend —
silakan tambahkan tabel baru + RPC dengan pola yang sama seperti contoh
`reimbursement_requests`/`leave_requests` di `supabase/schema.sql` kalau ingin
mengaktifkannya.

## 7. Alur persetujuan (approval) — sisi atasan/manager

Fungsi `decide_request(p_table, p_request_id, p_approve)` dipakai untuk
menyetujui/menolak pengajuan dan otomatis membuat notifikasi ke pengaju
(persis seperti "Change Shift Request approved" di Inbox pada gambar). UI
untuk atasan menyetujui pengajuan (tombol Setuju/Tolak) belum dibuat di
langkah ini — silakan beri tahu saya kalau Anda ingin saya lanjutkan bagian
itu juga.
