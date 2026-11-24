# Audit Workbook & Calculation Specification

Sumber: Google Sheets **CAT SPM – Strategic Planning Management**, sheet `SPC Schedule 2027`
(ID `13Sd-CqyoLq9cJVCsUMAj-HVWGoQtG41d4RywBPyMntc`, sheetId `250585702`).
Dibaca langsung melalui Google Sheets API (nilai + formula + conditional formatting) pada 24 Nov 2026.
Sheet sumber **tidak diubah**.

Dokumen ini adalah *source of truth* untuk calculation engine (`src/lib/engine`). Setiap angka
"Expected" di bawah diuji otomatis di `tests/engine.workbook.test.ts`.

## 1. Struktur sheet

| Area | Isi |
|---|---|
| `M4` / `M5` | Project Start `2027-01-01`, Project End `2027-12-31` |
| `M6` | `=DATEDIF(M4;M5;"d")/7` → 52 minggu |
| `Q5` | Display Week (1) |
| `V6` | `=M4-WEEKDAY(M4;1)+2+7*(Q5-1)` → Senin pada minggu Project Start (2026-12-28) |
| `V6:OB6` | Kalender harian (+1 hari per kolom) — area Gantt |
| Baris 8 | Header kolom tabel |
| Baris 9–12 | Data legacy 2022 (`#REF!`) — **di luar** rentang formula (15:77), tidak dimigrasi |
| Baris 14–77 | 12 baris divisi (`A` = angka 1..12) + baris SOP (`A` = `n.m`) |
| Baris 78–82 | Ringkasan All / CAT / Additional / CAT+Additional |
| `G91:G108` | Daftar hari libur (18 tanggal) |
| `H92:L105` | Monthly Achievement (Target, SOP Completion, SOP Awareness, Total) |
| `G114:S116` | Input bulanan Activity KPI (SOP Completion & SOP Awareness) |

### Kolom tabel SOP

| Kolom | Header | Isi |
|---|---|---|
| A | Task No | Divisi: konstanta 1..12. SOP: `=$A$14&"."&ROW()-ROW($A$14)` |
| B | Task Name | Nama divisi / nama SOP |
| E | CAT/Additiona | `CAT` / `Additional` / kosong |
| F | New/Revision | `New` / `Revision` / `Hold` (Hold dipakai sebagai filter pengecualian) |
| G | Critical | checkbox TRUE/FALSE |
| H, I | Start Date, End Date | tanggal |
| J | Mandays | `=NETWORKDAYS(H;I;$G$91:$G$107)-1` |
| K | Actual End Date | tanggal |
| L | Actual Days | `=NETWORKDAYS(H;K;$G$91:$G$107)-1` |
| M, N, O | Not Start / In Work / Complete | nilai progres (pecahan, mis. 0, 0.5, 1) |
| P, Q | Total CAT / Additional | Divisi: `COUNTIF(E..;"CAT")`, `COUNTIF(E..;"Additional")` |
| R | % CAT | lihat §2.3 |
| S | %Additional | lihat §2.3 |
| T | Man Days | Divisi: `=IF(OR(I=0;H=0);" - ";NETWORKDAYS(H;I))` (tanpa daftar libur, inklusif) |
| U | Remark | teks |

## 2. Formula & spesifikasi engine

### 2.1 Progres per SOP (data legacy M/N/O)

`BYROW(M:O; LAMBDA(r; IF(COUNTA(r)=0;;AVERAGE(r))))`

* Progres = **rata-rata nilai M/N/O yang terisi**.
* Bila ketiganya kosong, BYROW menghasilkan nilai kosong yang **diperlakukan 0** oleh `AVERAGE(FILTER(...))`.
  Bukti: SPM (10.1–10.4, CAT, tanpa input) → `R66 = 0%`, dan `R78 = 9,52%` = rata-rata 7 divisi termasuk SPM.
* Engine: `progress = null` ("Belum diinput") disimpan berbeda dari `0%` (Not Started), namun pada agregasi
  divisi nilainya dihitung **0** (setting `treat_uninput_as_zero = true`, default, sesuai sumber).
  Jumlah status (§2.5) tetap membedakan keduanya.

Status turunan data legacy: O terisi → Completed; N terisi → In Progress; M terisi → Not Started; kosong → Belum diinput.

SOP baru: satu input `progress_percentage` (0–100). Not Started = 0, In Progress = 1–99, Completed = 100.

### 2.2 Filter keanggotaan divisi

`REGEXMATCH(TO_TEXT(A);"^"&<no divisi>&"\.")` + `E = kategori` + `F <> "Hold"`.
Engine: `organization_id` + `task_type` + `workflow_status <> 'Hold'` + `is_active`.

### 2.3 % CAT / % Additional per divisi

`IFERROR(AVERAGE(FILTER(progressRow; divisi; E="CAT"; F<>"Hold")); "")`
→ rata-rata progres SOP kategori tsb; tidak ada SOP → `""` (engine: `null`, tampil **N/A**).

### 2.4 Overall

* `R78 = AVERAGE(FILTER(R14:R77; R<>""; A divisi))` → Overall % CAT = rata-rata % CAT divisi yang punya data CAT.
* `S78` sama untuk Additional.
* `M81 = (R78*80%)+(S78*20%)` → **Overall Achievement** (bobot dapat diubah Admin, total wajib 100%).
* Salah satu kategori tidak punya data → Overall = **N/A** (sheet akan `#VALUE!`; bobot tidak di-redistribusi).

### 2.5 Hitungan status (baris 78–80)

`SUMPRODUCT(REGEXMATCH(A;"^\d+\.\d+$"); F<>"Hold"; [E=kategori]; kolom<>"")` untuk M, N, O.

### 2.6 Hari kerja

| Ukuran | Formula sumber | Engine |
|---|---|---|
| Mandays | `NETWORKDAYS(Start; End; libur) - 1` | `mandays()` – libur yang `exclude_from_working_days = true` |
| Actual Days | `NETWORKDAYS(Start; ActualEnd; libur) - 1` | `actualDays()` |
| Man Days | `NETWORKDAYS(Start; End)` (tanpa libur, inklusif) | `manDays()` |

NETWORKDAYS: inklusif kedua ujung, Sabtu–Minggu non-kerja, start > end → hasil negatif.
Conditional format: Actual Days ≤ Mandays → hijau (on time), > Mandays → merah (late).

### 2.7 Monthly Achievement

* Target: Jan 10%, Feb 20%, Mar 30%, Apr 40%, Mei 50%, Jun 60%, Jul 75%, Agu 80%, Sep 85%, Okt 90%, Nov 95%, Des 100%.
* Jan–Sep: `Completion col = 100% × SOP Completion`, Awareness kosong.
* Okt–Des: `Completion col = 70% × SOP Completion`, `Awareness col = 30% × SOP Awareness`.
* `Total = SUM(Completion col; Awareness col)` – tidak di-cap (Des = 111%). Input kosong = 0.

Input awal (G115:S116): Completion Jan 20%, Okt 70%, Nov 100%, Des 120%; Awareness Nov 80%, Des 90%.

### 2.8 Gantt (conditional formatting)

* Bar rencana: `AND(NOT(ISBLANK(H)); H<=tgl; I>=tgl)`.
* Fill progres: `AND(H<=tgl; ROUNDDOWN((I-H+1)*$S;0)+H-1>=tgl)` → hari kalender sejak Start sebanyak `floor(durasi × progres)`.
* Garis hari ini: `tgl = TODAY()`.
* Minggu dimulai Senin (`V6`).

## 3. Expected results (data saat audit)

| Divisi | CAT | Additional | % CAT | % Additional |
|---|---:|---:|---:|---:|
| Legal | 1 | 1 | 50,00% | 30,00% |
| GA | 0 | 0 | N/A | N/A |
| Procurement | 1 | 0 | 0,00% | N/A |
| ITM | 3 | 0 | 16,67% | N/A |
| R & A | 0 | 0 | N/A | N/A |
| HC | 4 | 0 | 0,00% | N/A |
| FAT | 7 | 0 | 0,00% | N/A |
| Marcom | 0 | 0 | N/A | N/A |
| Exrel | 1 | 0 | 0,00% | N/A |
| SPM | 4 | 0 | 0,00% | N/A |
| GBU | 0 | 2 | N/A | 80,00% |
| Pilar Technology | 0 | 1 | N/A | 30,00% |

* Overall % CAT = **9,5238%** (66,667 / 7) · Overall % Additional = **46,6667%** (140 / 3)
* Overall Achievement (80/20) = **16,9524%** (sheet `M81` = 16,95%)
* Status: All 15 / 6 / 0 · CAT 15 / 2 / 0 · Additional 0 / 4 / 0
* Total SOP bernama: 26 (21 CAT, 4 Additional, 1 tanpa kategori)
* Mandays: 22/03–30/04/2027 = 28 · 03/05–11/06/2027 = 25 · 11/01–12/02/2027 = 24 · 15/02–24/03/2027 = 24 · 31/08–30/09/2026 = 22 · 01/10–30/10/2026 = 21
* Man Days 11/01–12/02/2027 = 25
* Monthly Total: Jan 20%, Feb–Sep 0%, Okt 49%, Nov 94%, Des 111%

## 4. Temuan / perbedaan (didokumentasikan sebelum implementasi)

| # | Temuan di sheet | Dampak | Keputusan implementasi |
|---|---|---|---|
| D1 | `P62` (Exrel Total CAT) di-hardcode `0`, `Q62 = SUM(M62:O62)` = 1 → SOP CAT terhitung sebagai Additional | Hitungan kategori Exrel salah (tidak memengaruhi % karena % memakai kolom E) | Hitung dari `task_type` (Exrel: CAT 1, Additional 0) |
| D2 | `P71`, `P74` hardcode 0; `Q71 = SUM(M71:P71)`, `Q74 = SUM(M74:P74)` | Kebetulan benar untuk data saat ini | Hitung dari `task_type` |
| D3 | Marcom `P58/Q58` = `COUNTIF(E59:E60)` tidak mencakup baris 61 | Baris baru di 8.3 tidak terhitung | Hitung dari `task_type` |
| D4 | `L59, L60, L67, L68, L69, L76, L77` memakai rentang libur bergeser (`G122:G138`, `G130:G146`, …) | Actual Days memakai daftar libur kosong | Selalu memakai tabel `holidays` |
| D5 | Rumus memakai `$G$91:$G$107` (17 tgl); `G108` = 26/12/2027 tidak ikut | Tidak berdampak (Minggu) | Semua libur dengan `exclude_from_working_days = true` |
| D6 | `J`/`L` saat tanggal kosong → `-1` atau angka negatif besar (mis. `-33187`) | Nilai tidak bermakna | Engine mengembalikan `null` ("—") |
| D7 | `T` (Man Days) baris divisi: H/I divisi kosong → `" - "`; `T29` merujuk `H32/I32`; `T19` `#REF!` | Tidak ada nilai Man Days valid per divisi | `manDays()` dihitung per SOP (NETWORKDAYS inklusif tanpa libur) |
| D8 | Fill progres Gantt memakai `$S` (kolom %Additional divisi) — pada baris SOP kosong → fill tidak pernah tampil | Progres tidak tervisualisasi | Memakai progres SOP masing-masing |
| D9 | Alternatif `Q81 = Q78/(P78+Q78)` (bobot berbasis jumlah, 19,05%) dan `R82 = 18,41%` | Dua angka "overall" berbeda di sheet | Mengikuti requirement: bobot tetap 80/20 (`M81`) |
| D10 | Label `P78` "Total CAT" sebenarnya = jumlah SOP CAT yang ber-input (17) | Rawan salah baca | Dashboard memakai label eksplisit |
| D11 | Baris tanpa nama namun berisi atribut: 2.2 (Revision), 2.4 (New, 01/10–30/10/2026), 5.1 (New, Critical) | Bukan SOP valid | Dilewati saat migrasi, dicatat di laporan import |
| D12 | `1.2 "xxxx"` (Additional, 30%) — nama placeholder namun memengaruhi % Additional Legal & overall | Menghapusnya mengubah hasil | Dimigrasi apa adanya + peringatan "nama placeholder" |
| D13 | `4.4 SOP Tata Kelola Proyek ITM` tanpa kategori | Tidak masuk CAT/Additional | Dimigrasi dengan `task_type = null` + peringatan |
| D14 | `9.1 SOP CSR` & baris 2.4 bertanggal 2026 (di luar periode 2027) | Bar di luar jendela Gantt default | Dimigrasi apa adanya; Gantt dapat digeser |
| D15 | Baris 76–77 (A = 11, 12) duplikat nomor divisi tanpa isi | Tidak berdampak | Dilewati |
| D16 | Belum ada SOP berstatus Hold pada data | — | Hold diuji dengan data sintetis di test |
| D17 | `G108` (26/12/2027) di sheet tidak berlabel; SKB 2027 menyebut 26/12/2027 "Isra Mikraj Nabi Muhammad saw." (kedua kalinya dalam 2027, sesuai kalender Hijriah) | — | Diberi label sesuai SKB |

## 5. Verifikasi SKB 3 Menteri 2027

SKB Menag, Menaker, MenPAN-RB No. 1205/2026, 3/2026, 2/2026 (ditetapkan 15 Sep 2026), sumber:
https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027

* **Libur Nasional (18 hari)** — identik dengan `G91:G108`.
* **Cuti Bersama (8 hari)** — 5 Feb, 9 Mar, 12 Mar, 15 Mar, 25 Mar, 18 Mei, 19 Mei, 24 Des 2027.
  Tidak ada di sheet → di-seed dengan kategori `Joint Leave` dan `exclude_from_working_days = false`
  (menunggu keputusan Administrator).
