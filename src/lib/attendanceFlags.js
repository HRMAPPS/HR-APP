import { tx } from './i18n'

// Tanda risiko absensi yang dibuat server (hanya terlihat oleh HR).
// level: 'high' | 'mid' perlu ditinjau; 'info' hanya informasi (mis. aplikasi versi lama).
const FLAGS = {
  gps_exact_office_center:   { level: 'high', label: () => tx("Koordinat tepat di titik kantor (kemungkinan lokasi dipalsukan)") },
  impossible_travel:         { level: 'high', label: () => tx("Perpindahan lokasi tidak masuk akal dari absen sebelumnya") },
  face_near_identical:       { level: 'high', label: () => tx("Data wajah hampir identik dengan absen sebelumnya") },
  gps_accuracy_zero:         { level: 'high', label: () => tx("Akurasi GPS nol (tidak wajar)") },
  gps_identical_to_previous: { level: 'mid',  label: () => tx("Koordinat sama persis dengan absen sebelumnya") },
  gps_stale:                 { level: 'mid',  label: () => tx("Lokasi GPS sudah lama (basi)") },
  gps_round_coords:          { level: 'mid',  label: () => tx("Koordinat dibulatkan (tidak seperti GPS asli)") },
  gps_low_accuracy:          { level: 'mid',  label: () => tx("Akurasi GPS rendah (lebih dari 100 m)") },
  new_device:                { level: 'mid',  label: () => tx("Perangkat baru yang belum pernah dipakai") },
  face_weak_match:           { level: 'mid',  label: () => tx("Kecocokan wajah lemah") },
  short_shift:               { level: 'mid',  label: () => tx("Durasi kerja kurang dari 30 menit") },
  face_reenrolled:           { level: 'mid',  label: () => tx("Wajah didaftarkan ulang") },
  no_device_id:              { level: 'info', label: () => tx("Perangkat tidak teridentifikasi (aplikasi versi lama)") },
  gps_no_accuracy:           { level: 'info', label: () => tx("Akurasi GPS tidak dikirim (aplikasi versi lama)") },
}

export const flagLabel = (f) => (FLAGS[f] ? FLAGS[f].label() : f)
export const flagLevel = (f) => (FLAGS[f] ? FLAGS[f].level : 'mid')
export const reviewFlags = (flags) => (flags || []).filter((f) => flagLevel(f) !== 'info')
