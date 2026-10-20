/* Menggantikan service worker lama (vite-plugin-pwa / workbox) yang menyimpan versi aplikasi lama.
   Tidak menyimpan cache apa pun: semua permintaan selalu ke jaringan. Membersihkan cache lama saat aktif. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', function () { /* sengaja kosong: tanpa cache */ });
