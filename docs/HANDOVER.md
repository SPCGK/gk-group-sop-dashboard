# Panduan Serah Terima (Handover) – GK SOP Dashboard

Dokumen ini memastikan aplikasi tetap berjalan dan dapat dilanjutkan oleh orang lain bila pengelola saat ini
pindah tugas atau resign. Simpan dokumen ini bersama repository.

## 1. Peta aset (isi saat setup, perbarui saat ada perubahan)

| Aset | Lokasi / nilai | Pemilik saat ini | Pemilik cadangan |
|---|---|---|---|
| Repository GitHub | `https://github.com/<org>/gk-group-sop-dashboard` | | |
| Website | `https://<org>.github.io/gk-group-sop-dashboard/` | (ikut repository) | |
| Google Sheet database | *GK SOP Dashboard – Database* (link) | | |
| Apps Script | Extensions → Apps Script di Sheet tersebut | (ikut Sheet) | |
| Web App URL | `https://script.google.com/macros/s/…/exec` (juga di `public/app-config.json`) | Akun yang melakukan *Deploy* | |
| Project Google Cloud (OAuth Client ID) | `gk-sop-dashboard` | | |
| Sheet sumber SPC Schedule | ID di System Settings | | |

### Prinsip agar aplikasi "tidak ikut resign"
1. **Google Sheet di Shared Drive** divisi (milik perusahaan, bukan milik pribadi). File di Shared Drive tetap ada walau akun pembuatnya dihapus.
2. **Deploy Apps Script dengan akun peran/divisi** (mis. akun SPM), bukan akun pribadi. Web App berjalan *sebagai akun yang men-deploy*; bila akun itu dihapus, Web App berhenti. Jika terpaksa memakai akun pribadi, lakukan langkah §3.3 sebelum resign.
3. **Repository di GitHub Organization** perusahaan dengan **minimal 2 Owner**.
4. **Project Google Cloud** dengan **minimal 2 Owner** (IAM).
5. **Minimal 2 Administrator aktif** di aplikasi (System Settings → Administrator). Aplikasi menolak menonaktifkan admin terakhir.

## 2. Checklist serah terima (lakukan berurutan, sebelum hari terakhir)

| # | Langkah | Cara | ✔ |
|---|---|---|---|
| 1 | Tambahkan penerus sebagai Administrator aplikasi | Panel admin → System Settings → Tambah Administrator | |
| 2 | Pastikan penerus bisa login & mengubah data | Penerus login, ubah progres SOP uji, cek Audit Log | |
| 3 | Beri penerus akses Google Sheet | Bila di Shared Drive: tambahkan sebagai *Manager*. Bila milik pribadi: *Share* → jadikan **Owner** (atau pindahkan ke Shared Drive) | |
| 4 | Pindahkan deployment Apps Script bila Anda yang men-deploy | Lihat §3.3 | |
| 5 | Beri penerus akses GitHub | Organization → People → jadikan **Owner**, atau repository → Settings → *Transfer ownership* | |
| 6 | Beri penerus akses Google Cloud | console.cloud.google.com → IAM → tambah sebagai **Owner** | |
| 7 | Perbarui tabel §1 di dokumen ini | Edit `docs/HANDOVER.md` di GitHub | |
| 8 | Nonaktifkan akun Anda sebagai Administrator | Dilakukan oleh penerus (System Settings) setelah semua langkah berhasil | |

## 3. Prosedur teknis

### 3.1 Menambah / mencabut Administrator
Panel admin → **System Settings → Administrator**. Email harus akun Google @gankapital.com.
Darurat (tidak ada admin yang bisa login): pemilik Google Sheet membuka tab `admins` dan mengisi `is_active` = `TRUE` untuk email yang benar (bila tab dilindungi, hanya pemilik yang bisa).

### 3.2 Memperbarui kode server (Apps Script)
1. Salin isi `apps-script/Code.gs` terbaru ke editor Apps Script.
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
   Cara ini **mempertahankan URL** sehingga `public/app-config.json` tidak perlu diubah.

### 3.3 Memindahkan deployment ke akun lain (penting saat resign)
1. Akun baru (penerus / akun divisi) harus menjadi editor/pemilik Google Sheet.
2. Akun baru membuka **Extensions → Apps Script → Deploy → New deployment → Web app** (*Execute as: Me*, *Anyone*) → salin URL baru.
3. Akun baru menjalankan menu **GK SOP → Info deployment** untuk memastikan.
4. Edit `public/app-config.json` di GitHub → ganti `apiUrl` → *Commit* → tunggu Actions selesai.
5. Uji dashboard & login. Setelah berhasil, akun lama: **Deploy → Manage deployments → Archive** deployment lamanya.
6. Pastikan akun baru dapat membuka **Sheet sumber SPC Schedule** (minimal Viewer) agar fitur impor tetap berfungsi.

### 3.4 Mengganti OAuth Client ID
Buat Client ID baru (README langkah B) → System Settings → *OAuth Client ID*, atau menu Sheet **GK SOP → 2. Atur OAuth Client ID**.
Bila alamat website berubah (pindah organisasi GitHub / domain kustom), tambahkan origin baru di *Authorized JavaScript origins*.

### 3.5 Pergantian tahun (mis. 2028)
1. System Settings → **Periode Project** 2028-01-01 s/d 2028-12-31.
2. Holiday Management → tambahkan libur nasional & cuti bersama 2028 dari SKB 3 Menteri terbaru; putuskan status cuti bersama.
3. Monthly Achievement → isi target & bobot 2028 (disimpan per tahun; data 2027 tetap ada).
4. Master SOP → arsipkan SOP 2027 yang selesai, tambah SOP baru, atau impor sheet SPC tahun baru (System Settings → ID & nama sheet sumber).

### 3.6 Memperbarui tampilan / calculation engine
Edit kode di GitHub → setiap *commit* ke `main` otomatis menjalankan 115 test lalu deploy. Bila test gagal, situs lama tetap tayang.
Rumus hanya boleh diubah di `src/lib/engine` dan harus disertai pembaruan `docs/AUDIT_SPEC.md` + test.

## 4. Pemecahan masalah

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| Dashboard: "URL Web App Apps Script belum diisi" | `public/app-config.json` kosong / salah | Isi `apiUrl` (§3.3 langkah 4) |
| Dashboard: "Data belum dapat dimuat" | Deployment dihapus / akun pemilik deployment nonaktif | Deploy ulang (§3.3) |
| Login: "Login belum dikonfigurasi" | OAuth Client ID kosong | §3.4 |
| Tombol Google error *origin not allowed* | Alamat website belum terdaftar di Client ID | Tambah origin (§3.4) |
| "… tidak terdaftar sebagai Administrator aktif" | Email belum ditambahkan / dinonaktifkan | §3.1 |
| Impor Google Sheets: "tidak dapat dibuka" | Akun pemilik deployment tidak punya akses sheet sumber | Bagikan sheet sumber (Viewer) ke akun tersebut |
| GitHub Actions merah | Test gagal setelah perubahan kode | Buka log Actions; perbaiki atau *revert* commit |

## 5. Data & cadangan
* Seluruh data ada di Google Sheet database; riwayat versi tersedia di **File → Version history**.
* Disarankan: **File → Make a copy** setiap akhir bulan ke folder arsip, atau ekspor laporan dari menu Reports & Export.
* Audit log tab `audit_logs` jangan dihapus; gunakan perlindungan tab (menu GK SOP).
