# GK Group – SOP Management & Performance Dashboard 2027

Aplikasi monitoring SOP GK Group: Master SOP, organisasi, progres, CAT/Additional, Overall Achievement,
Gantt Chart, Monthly Achievement, hari libur, laporan, dan audit log.

**Hanya memakai GitHub + Google (tanpa server berbayar):**

| Bagian | Di mana | Siapa yang mengelola |
|---|---|---|
| Tampilan web (dashboard publik + panel admin) | **GitHub Pages** – dibangun otomatis oleh GitHub Actions | Repository GitHub |
| Database | **Google Sheet** "GK SOP Dashboard – Database" (tab `organizations`, `sop_tasks`, `holidays`, …) | Google Drive / Shared Drive |
| Server (validasi, hak akses, audit log) | **Google Apps Script** yang menempel di Google Sheet tersebut (`apps-script/Code.gs`) | Pemilik Google Sheet |
| Login Administrator | **Sign in with Google** (akun @gankapital.com) | Daftar email di System Settings |

* Dashboard publik `/` tanpa login, read-only.
* Panel admin `/admin/` – hanya email yang ada di tab `admins` yang dapat mengubah data. Pengecekan dilakukan di server (Apps Script), bukan di browser.
* Semua perhitungan memakai satu calculation engine (`src/lib/engine`) sesuai [`docs/AUDIT_SPEC.md`](docs/AUDIT_SPEC.md).
* **Overall Achievement** = (% CAT × 100%) + (% Additional × bobot Additional), dengan bobot Additional = Σ SOP Additional ÷ (Σ SOP CAT + Σ SOP Additional); SOP Hold & belum diinput tidak dihitung.
* **Serah terima / pewarisan aplikasi:** baca [`docs/HANDOVER.md`](docs/HANDOVER.md).

---

## Setup pertama kali (±30 menit, sekali saja)

> Lakukan dengan **akun peran/divisi** (mis. akun SPM) atau di **Shared Drive**, bukan akun pribadi – agar aplikasi tetap berjalan bila ada karyawan yang resign. Lihat HANDOVER.md §1.

### A. Database & server (Google Sheet + Apps Script)
1. Di Google Drive (disarankan **Shared Drive** divisi) buat Google Sheet baru: **GK SOP Dashboard – Database**.
2. Menu **Extensions → Apps Script**. Ganti nama project menjadi `GK SOP Dashboard API`.
3. Salin isi file dari folder `apps-script/` repository ini:
   * `Code.gs` → tempel ke file `Code.gs`.
   * Tambah file (＋ → Script) bernama `Seed` → tempel isi `Seed.gs`.
   * **Project Settings** → centang *Show "appsscript.json" manifest file* → buka `appsscript.json` → tempel isinya.
4. Simpan, kembali ke Google Sheet, **refresh** halaman. Muncul menu **GK SOP** → klik **1. Setup database** → izinkan akses (Authorize).
   Hasilnya: 9 tab dibuat dan diisi 12 organisasi, 26 SOP, 26 hari libur (SKB 2027), target bulanan, dan admin awal `michael.damar@gankapital.com` + akun pemilik.
5. Di editor Apps Script: **Deploy → New deployment → Web app**
   * *Execute as*: **Me** · *Who has access*: **Anyone** → **Deploy** → salin **Web app URL** (`https://script.google.com/macros/s/…/exec`).
6. (Disarankan) Menu **GK SOP → Lindungi tab dari edit manual**, agar data hanya berubah melalui aplikasi dan selalu tercatat di Audit Log.

### B. Login Google (OAuth Client ID)
1. Buka <https://console.cloud.google.com> → buat project **gk-sop-dashboard** (di organisasi gankapital.com).
2. **APIs & Services → OAuth consent screen** → User type **Internal** (hanya akun @gankapital.com yang dapat login) → isi nama aplikasi & email.
3. **Credentials → Create credentials → OAuth client ID** → *Web application*
   * *Authorized JavaScript origins*: `https://<nama-akun-atau-organisasi-github>.github.io` (dan domain kustom bila ada).
   * Salin **Client ID** (`…apps.googleusercontent.com`). Client ID bukan rahasia.
4. Di Google Sheet: menu **GK SOP → 2. Atur OAuth Client ID** → tempel.

### C. Website (GitHub Pages)
1. Buat repository **publik** `gk-group-sop-dashboard` (disarankan di **GitHub Organization** perusahaan, lihat HANDOVER.md).
   GitHub Pages gratis untuk repository publik; tidak ada rahasia di dalam kode.
2. Unggah seluruh isi folder project (cara termudah: GitHub Desktop → *Add existing repository* → *Publish*; atau `git push`).
3. Edit file **`public/app-config.json`** langsung di GitHub (ikon pensil) → isi `apiUrl` dengan Web app URL dari langkah A.5 → *Commit*.
4. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Tab **Actions** → workflow *Test & deploy to GitHub Pages* berjalan (test + build + deploy, ±3 menit).
   Situs: `https://<akun-atau-organisasi>.github.io/gk-group-sop-dashboard/`.

### D. Cek
* Dashboard publik tampil tanpa login dengan Overall Achievement awal **18,41%** (sama dengan sel R82 workbook: 9,52% CAT + 8,89% Additional).
* **Login Admin** → *Sign in with Google* → panel admin terbuka untuk email terdaftar; email lain ditolak.
* Tambah SOP percobaan → muncul di Dashboard & Gantt → arsipkan → cek Audit Log.

---

## Pemakaian sehari-hari (tanpa menyentuh kode)

| Kebutuhan | Menu |
|---|---|
| Tambah / ubah / arsipkan SOP, update progres | SOP Management, Add New SOP, Master SOP |
| Tambah divisi/BU | Organization Management |
| Libur nasional, cuti bersama, libur perusahaan | Holiday Management |
| Target & input bulanan | Monthly Achievement |
| Periode project, Client ID, sumber impor | System Settings |
| Tambah / nonaktifkan Administrator | System Settings → Administrator |
| Impor dari sheet SPC Schedule (langsung atau CSV) | Master SOP → Import |
| Unduh Excel / CSV / PDF | Reports & Export |
| Riwayat perubahan | Audit Log |

## Struktur kode

```
apps-script/            Server: Code.gs (API), Seed.gs (data awal), appsscript.json (manifest)
src/app/(public)/       Dashboard, Gantt, Monthly, Kalender (publik)
src/app/admin/          Login + 11 menu admin
src/lib/engine/         ★ Calculation engine terpusat (satu-satunya tempat formula)
src/lib/import/         Parser sheet SPC Schedule 2027
src/lib/export/         Laporan Excel / CSV / PDF (dibuat di browser dari hasil engine)
tests/                  124 test: engine vs workbook, parser, export, backend Apps Script
docs/AUDIT_SPEC.md      Spesifikasi formula & temuan audit
docs/HANDOVER.md        Panduan pewarisan / serah terima
.github/workflows/      Test + deploy otomatis ke GitHub Pages
```

## Pengembangan (opsional, untuk yang mengubah kode)

```bash
npm ci
npm test          # 124 test
npm run dev       # http://localhost:3000 (isi public/app-config.json dengan URL Web App)
npm run build     # hasil statis di folder out/
```

Setiap *push* ke branch `main` menjalankan test; deploy hanya terjadi bila semua test lulus.

## Keamanan
* Google Sheet database **tidak dibagikan publik**. Publik hanya mendapat data baca melalui Web App (`publicData`), tanpa audit log / daftar admin.
* Setiap perubahan: token *Sign in with Google* diverifikasi ke Google (`aud` = Client ID, email terverifikasi, belum kedaluwarsa) → email dicek di tab `admins` → input divalidasi → ditulis dengan *lock* → dicatat ke `audit_logs` (nilai lama & baru).
* Semua sel disimpan sebagai teks, sehingga input yang menyerupai rumus (`=…`) tidak dieksekusi.
* Tidak ada password, API key, atau token rahasia di repository.

## Batas layanan gratis
Google Apps Script memiliki kuota harian (mis. jumlah eksekusi dan panggilan URL Fetch) – lebih dari cukup untuk beberapa admin dan ratusan pengunjung per hari. Detail terbaru: <https://developers.google.com/apps-script/guides/services/quotas>. GitHub Pages: situs ≤1 GB dan bandwidth ±100 GB/bulan (soft limit). Kuota dapat berubah sewaktu-waktu.
