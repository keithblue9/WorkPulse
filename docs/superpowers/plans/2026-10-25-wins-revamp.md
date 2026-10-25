# WINS Revamp (Pulse Aurora) — Rencana Implementasi

> **Untuk eksekutor:** REQUIRED SUB-SKILL: superpowers:executing-plans (native). Langkah memakai checkbox `- [ ]`.

**Goal:** Menerapkan keputusan Step 3 (F1–F7 + hotfix keamanan) dan desain Pulse Aurora ke seluruh menu WINS tanpa mengubah satu pun data yang sudah ada di MongoDB.

**Architecture:** Next.js 16 App Router tetap. Keamanan ditaruh di `proxy.ts` (gerbang auth) + endpoint berbahaya dihapus. Semua handler `GET` dibuat read-only. Tampilan baru lewat token CSS Aurora yang dipetakan ke variabel lama (`--bg`, `--text`, `--brand`, …) sehingga semua halaman ikut berubah, lalu tiap halaman dirapikan memakai komponen `components/ui/*`. Fitur baru (Progress v2, Enhancement, multi-year) memakai mesin hitung murni di `lib/` yang diuji unit.

**Tech Stack:** Next.js 16.2.9, React 19, TypeScript, Mongoose 9, NextAuth v4, Zustand, exceljs, Vitest (baru, dev), FerretDB lokal untuk uji (di luar repo).

**Spec:** Keputusan Step 3 & 4 di percakapan + prototipe `wins-pulse-aurora.html` (artifact RZFAJ3d6MnKLc69xzmgeoq).

## Global Constraints

- **Tidak ada data yang berubah**: tanpa skrip migrasi/seed/reset; tidak ada `GET` yang menulis; field lama tidak dihapus/diganti; koleksi fitur yang dihapus tetap utuh.
- Konversi 14 initiative lama dilakukan saat dibaca (adapter), bukan ditulis ulang.
- Nama aplikasi tampil "WINS"; nilai lama `WorkPulse`/`WinS`/`Work Intelligence System`/kosong ditampilkan sebagai "WINS" tanpa menulis ke DB; bisa diganti di Config.
- SSP dikecualikan total; Enhancement hanya sheet `BPDP - …`.
- Tahap BRD (7): Drafting, Pre-review, Submit [To T&D], Revisi, Final Submit [to T&D], Submit [To BR], Development. BRD% = tahap/7.
- Template aktivitas Enhancement default: BRD 30, Development 40, UAT 15, Go Live 10, Stabilisasi 5 (editable di Config & per enhancement, total wajib 100).
- Plan-to-date linear per hari; SPI = actual/plan; status: SPI ≥ 1 On track, ≥ 0,9 Perlu perhatian, < 0,9 Terlambat, plan 0 → Belum mulai.
- Reimbursement tidak tampil di dashboard. Struktur menu tetap seperti sekarang (+ Enhancement).
- Gerbang tiap commit: `npx tsc --noEmit` = 0 error, `npm test` hijau; gerbang tiap fase: `npm run build` sukses + smoke test semua halaman tanpa error console + checksum DB lokal sama sebelum/sesudah crawl.
- Tidak ada push/merge/deploy tanpa persetujuan eksplisit user.

## Review Focus

1. Initiative lama tanpa `start/end` (hanya `planCells`, atau kosong) → adapter tidak menghasilkan NaN; progress 0 dan "Belum mulai".
2. Dokumen Config lama dengan key widget AI / field kosong → tidak crash, widget AI tersembunyi, tidak ada tulis ke DB.
3. Sesi guest memanggil API di luar daftar izin → 403; halaman yang dibuka guest tetap tampil (empty state), bukan error.
4. Tahun tanpa data (2025/2027) di tiap menu → empty state, tidak membuat dokumen baru (cashier/pettycash/golive).
5. Upload Excel salah format / skor di luar 0–5 / file terkunci → pesan jelas, tidak ada yang tersimpan sebelum "Simpan".

---

## Fase 0 — Persiapan

### Task 0: Branch, Vitest, harness uji lokal
**Files:** Modify `package.json` (script `test`, devDep `vitest`); Create `vitest.config.ts`; harness (FerretDB, seed dummy, smoke, checksum) disimpan di luar repo.
- [ ] Branch `feature/workpulse-revamp-2026-10-25`.
- [ ] `npm i -D vitest` ; `"test": "vitest run"`.
- [ ] Harness: FerretDB lokal + data dummy + `smoke.mjs` (login, buka semua halaman di 1440/390, catat error console) + `checksum.mjs` (hash semua koleksi).
- [ ] Baseline: tsc 0 error (✔ sudah), build sukses, smoke baseline.

## Fase 1 — Keamanan & read-only

### Task 1: Hapus endpoint berbahaya
**Files:** Delete `app/api/reset-pin/route.ts` (GET mereset PIN semua user ke 123456), `app/api/debug-login/route.ts`, `app/api/seed/route.ts`, `lib/seed.ts` (bila tak dipakai), `app/api/golive/seed/*` (drop koleksi!), `lib/auth.ts` (API v5 tak terpakai, secret hardcoded); Modify `app/dashboard/golive/page.tsx` (hapus tombol Import/`doSeed`).
- [ ] Verifikasi: `curl /api/reset-pin` → 404; grep tidak ada referensi tersisa; tsc 0.
- [ ] Commit `fix(security): hapus endpoint reset-pin, seed, debug-login`.

### Task 2: GET read-only
**Files:** Create `lib/configMerge.ts` (`mergeConfigDefaults(cfg)`, `mergeWidgets(existing, defaults)` murni); Modify `app/api/config/route.ts`, `app/api/golive/route.ts`, `app/api/cashier/route.ts`, `app/api/pettycash/route.ts`; Test `lib/__tests__/configMerge.test.ts`.
- [ ] Test: `mergeWidgets` membuang key `ai-*` dari hasil tanpa mutasi input; `mergeConfigDefaults({})` mengisi semua fallback; nama legacy → `displayName === 'WINS'`.
- [ ] GET tidak memanggil create/update/insert; dokumen default dibangun di memori.
- [ ] Verifikasi checksum DB lokal sama setelah GET semua route.
- [ ] Commit `fix(api): GET config/golive/cashier/pettycash tidak menulis ke DB`.

### Task 3: Gerbang auth `proxy.ts`
**Files:** Create `proxy.ts`, `lib/access.ts` (`PUBLIC_API`, `GUEST_GET_API`, `ADMIN_WRITE_API`, `classify(path, method, token)` murni); Test `lib/__tests__/access.test.ts`; Modify `app/api/users/route.ts` & `[id]` (buang `password`, `fonnteToken` dari respons).
- [ ] Test: tanpa token `/api/users` → 401; guest `GET /api/dashboard` → lolos, guest `POST /api/projects` → 403; member `PATCH /api/config` → 403; admin → lolos; `/api/auth/*` & `/api/warmup` publik; `/dashboard/*` tanpa token → redirect `/login`.
- [ ] Cron `/api/cron/reminders` publik, tapi bila env `CRON_SECRET` ada wajib `Authorization: Bearer`.
- [ ] Commit `feat(security): gerbang auth proxy untuk halaman dan API`.

### Task 4: Payload config ramping
**Files:** Modify `app/api/config/route.ts` (`?scope=login` publik hanya field login; default tanpa `loginBackgrounds`), `app/login/page.tsx` (pakai scope=login), `lib/configCache.ts`.
- [ ] Verifikasi ukuran respons `/api/config` turun (catat sebelum/sesudah).
- [ ] Commit `perf(config): jangan kirim loginBackgrounds ke halaman dashboard`.

## Fase 2 — Penghapusan fitur & nama

### Task 5: F1 hapus fitur tak terpakai
**Files:** Delete pages/routes `meetings`, `playground`, `ai-insight`, `chat`, `fonnte`, `components/Wibi.tsx`; Modify nav (`app/dashboard/layout.tsx`), `lib/defaults.ts` (menu keys & widget AI keluar dari DEFAULT), dashboard (widget AI), `BirthdayPopup` (tanpa AI, teks statis), reimbursements (hapus panggilan fonnte), config page (tab WhatsApp), members (field token Fonnte), thirdparty (tab Realisasi; realisasi final di Rencana tetap); `next.config.ts` `redirects()` URL lama → `/dashboard`. Model tetap.
- [ ] Verifikasi: grep `fonnte|ai-insight|playground|meetings|RealisasiTab` kosong di app/components (kecuali model); build sukses.
- [ ] Commit `feat!: hapus meeting reports, AI insight, playground, fonnte, tab realisasi`.

### Task 6: F3 nama WINS
**Files:** Create `lib/appName.ts` (`displayAppName(name?: string): string`); Modify layout metadata, manifest, login, sidebar, export (nama file), Config default `'WINS'` (hanya dokumen baru).
- [ ] Test: `displayAppName(undefined|'WorkPulse'|'WinS'|'Work Intelligence System'|'') === 'WINS'`, `displayAppName('Tim BPD') === 'Tim BPD'`.
- [ ] Commit `feat: nama aplikasi WINS, bisa diubah di Config`.

## Fase 3 — Design system Aurora

### Task 7: Font & token
**Files:** devDeps → deps `geist`, `@fontsource-variable/bricolage-grotesque`; `app/layout.tsx` (next/font/local, `--font-sans/--font-display/--font-mono`, themeColor `#4B3BFF`); `app/globals.css` (palet Aurora terang/gelap menggantikan 8 tema; kelas lama `.card .btn .input .modal .wp-table …` diberi gaya Aurora; motion transform/opacity + reduced-motion); `lib/theme.tsx` (`light|dark|system`, key lama dipetakan: dark/elegant/nature → dark, sisanya → light, tanpa menulis ulang preferensi tersimpan).
- [ ] Verifikasi visual semua halaman terang & gelap (screenshot), kontras teks muted ≥ 4.5:1.
- [ ] Commit `feat(ui): token & font Pulse Aurora`.

### Task 8: Komponen UI dasar
**Files:** Create `components/ui/{Icon,PageHeader,Tile,Seg,Pill,Ring,Sheet,Empty,Track}.tsx` + `components/ui/index.ts`.
- [ ] Props: `PageHeader({eyebrow,title,actions})`, `Tile({icon,tone,value,label,active,onClick})`, `Seg<T>({options,value,onChange,label})`, `Pill({tone,children})`, `Ring({value,size,stroke,color,plan?})`, `Sheet({open,title,onClose,onSave?,saveDisabled?,wide?,children})`, `Empty({title,text,action?})`.
- [ ] Commit `feat(ui): komponen dasar Aurora`.

### Task 9: Shell aplikasi
**Files:** Rewrite `app/dashboard/layout.tsx` (sidebar kaca menu as-is + Enhancement "BARU"; top bar: breadcrumb, ⌘K palette, Year seg, tema, profil; HP: top bar + tab bar Beranda/Progress/Enhance/Notes/Menu), Create `app/dashboard/menu/page.tsx`, `components/CommandPalette.tsx`.
- [ ] Permission menu tetap memakai `allowedMenusFor` + fallback lama; `enhancement` diizinkan semua role internal.
- [ ] Commit `feat(ui): shell sidebar, top bar, tab bar, palette`.

### Task 10: F4 multi-year
**Files:** Create `lib/year.ts` (zustand `useYear()` → `{year,setYear,years}`; persist localStorage `wins-year`; default tahun berjalan), `components/YearSeg.tsx`; Modify setiap halaman yang punya state tahun lokal agar memakai `useYear()`.
- [ ] Test: `yearsRange(dataYears, now)` mengembalikan rentang kontinu min..max(now+1).
- [ ] Commit `feat: pemilih tahun global untuk semua menu`.

## Fase 4 — Fitur

### Task 11: Mesin progress (F6/F7)
**Files:** Create `lib/progress.ts`, Test `lib/__tests__/progress.test.ts`.
- [ ] `ptd(a, today)`, `planAt(acts,t)`, `calc(acts,today) → {plan,actual,spi,W}`, `statusOf(spi)`, `actsFromPhases(phases, year)`.
- [ ] Test angka: aktivitas 1–30 Jan, today 16 Jan → ptd ≈ 50; today ≥ 31 Jan → 100; sebelum mulai → 0; bobot 0 semua → plan 0 tanpa NaN; `actsFromPhases` dari `planCells ['3-1','3-4']` → start `YYYY-03-01`, end `YYYY-03-31`, `pct = min(actual/plan,1)*100`.
- [ ] Commit `feat(progress): mesin plan-to-date & SPI`.

### Task 12: Halaman Progress Project baru
**Files:** `models/Initiative.ts` (PhaseSchema + `start,end:String`, `weight,pct:Number` opsional), rewrite `app/dashboard/progress/page.tsx` (kartu ring, Gantt, kurva S, sheet edit tanggal/bobot/% dgn pratinjau status).
- [ ] Simpan mengirim phase utuh (field lama ikut, tidak dibuang) + field baru.
- [ ] Commit `feat(progress): input sederhana tanggal, bobot, % selesai`.

### Task 13: Enhancement (F5)
**Files:** Create `models/Enhancement.ts`, `lib/enhancement.ts` (`score(items)`, `STAGES`, `TPL`, `enhActs(e)`), `app/api/enhancements/route.ts`, `[id]/route.ts`, `import/route.ts` (exceljs, hanya `BPDP - …`, preview → commit), `app/dashboard/enhancement/page.tsx`; Test `lib/__tests__/enhancement.test.ts` (24 baris referensi → kategori sama dengan Excel), parser test dengan workbook buatan.
- [ ] Menu key `enhancement` untuk semua role internal; Config: bobot template default.
- [ ] Commit `feat(enhancement): menu enhancement + upload excel`.

### Task 14: Team Notes tanpa kanban (F2)
**Files:** Rewrite tampilan `app/dashboard/notes/page.tsx` jadi daftar per kategori (pin, pindah kategori, cari). API tetap.
- [ ] Commit `feat(notes): daftar terkelompok menggantikan kanban`.

### Task 15: Dashboard baru
**Files:** Rewrite `app/dashboard/page.tsx` (Manajemen / Fokus saya), memakai API yang ada; widget AI & reimburse tidak ada.
- [ ] Commit `feat(dashboard): dashboard Aurora manajemen & fokus saya`.

## Fase 5 — Re-skin semua menu (logika & API tidak berubah)

### Task 16–24
Activities+Issues+Calendar · Mandatory+Go-Live · Personal Notes · Presensi · Link Hub+Biodata+Member+Profil · Reimbursement+Cashier+Operasional+Cash Card · 3rd Party Event+Budget · Configuration · Login.
- [ ] Tiap halaman: `PageHeader`, tile status, `Seg`/chip filter, tabel dalam wadah scroll, modal → `Sheet`, empty/loading/error state, `useYear()`.
- [ ] Smoke halaman terkait di 1440 & 390, terang & gelap; commit per kelompok `style(<menu>): tampilan Aurora`.

## Fase 6 — Verifikasi akhir (lanjut ke Step 7)
- [ ] tsc 0, `npm test`, `npm run build`, smoke semua halaman × role (admin, member, guest) × tahun 2025/2026/2027, checksum DB tidak berubah.
