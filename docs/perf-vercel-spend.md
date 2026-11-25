# Hemat biaya Vercel (P0–P3)

## Masalah
Heartbeat presence (POST tiap 45 dtk) dianggap "data berubah" oleh `watchMutations` → dashboard memuat ulang
semua API, termasuk `/api/notes` (≈ 493 KB karena gambar base64) dan `/api/config` (≈ 141 KB, dipaksa `no-store`).
Satu tab dashboard yang terbuka ≈ 50 MB/jam transfer.

## Perubahan
| | Apa | Di mana |
|---|---|---|
| P0 | POST latar belakang (presence, check-reminders, push, auth, version, warmup) tidak memicu `wins:data-changed`; dashboard tidak refresh saat tab tersembunyi; config tidak dipaksa `no-store` | `lib/fetchCache.ts`, `app/dashboard/page.tsx` |
| P1 | `GET /api/notes` tanpa base64 (gambar → `/api/notes/<id>/image/<n>`, lazy + cache browser); `?pinned=1` untuk widget dashboard; PATCH memulihkan rujukan gambar ke aslinya (tidak ada gambar hilang) | `lib/notesImages.ts`, `app/api/notes/**` |
| P2 | `GET /api/config` memakai ETag + `private, no-cache` (304 bila sama); `DailyCheckin`/`AppPopups`/`BudgetInsights` memakai `getConfig()` bersama; log ukuran field terbesar bila > 64 KB | `lib/httpCache.ts`, `app/api/config/route.ts` |
| P3 | Presence 60 dtk & berhenti saat tab tersembunyi (jendela online 150 dtk); update service worker 15 mnt; VersionWatch lewati tab tersembunyi; gambar baru di catatan di-upload ke Vercel Blob; route migrasi gambar lama | `components/OnlinePresence.tsx`, `lib/noteImageUpload.ts`, `app/api/admin/migrate-note-images` |

## Migrasi gambar lama ke Blob (opsional, admin)
Tidak wajib: gambar base64 lama tetap tampil lewat route gambar. Migrasi mengurangi ukuran database dan fungsi.
1. Buat snapshot/backup database.
2. Login sebagai admin, buka konsol browser di aplikasi:
   - Pratinjau: `fetch('/api/admin/migrate-note-images').then(r => r.json())`
   - Jalankan: `fetch('/api/admin/migrate-note-images?confirm=yes&limit=5', { method: 'POST' }).then(r => r.json())`
   - Ulangi dengan `&after=<next>` dari balasan sampai `next` kosong. Aman diulang; catatan yang dilewati dilaporkan beserta alasannya.
3. Gambar di Blob bersifat **publik** (URL acak, tidak bisa ditebak) — sama seperti bukti reimbursement.

## Verifikasi setelah deploy
Vercel → project workpulse → Observability → Fast Data Transfer → Routes. Dalam 24 jam, `/api/notes` dan `/api/config`
seharusnya turun dari ratusan request/12 jam menjadi puluhan, dan transfer `/api/notes` dari ratusan MB menjadi kecil.
Cek juga Vercel Logs untuk `[config] payload besar` — itu menunjukkan field config mana yang membengkak.

## Perubahan perilaku yang disengaja
- Tab yang tersembunyi tidak mengirim heartbeat → pengguna tampil offline setelah ±2,5 menit di background.
- Update service worker tiap 15 menit (dulu 60 dtk); versi baru tetap terdeteksi VersionWatch tiap 5 menit & saat tab difokuskan.
