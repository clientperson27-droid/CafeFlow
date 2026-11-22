# CafeFlow — Smart Cafe POS, QR Ordering & Price List

Aplikasi kasir cafe + pemesanan lewat QR meja + daftar harga (cafe & steam) untuk promosi.
Frontend statis (folder ini, untuk GitHub Pages) + server Google Apps Script (REST API JSON) + database Google Sheets.

## Halaman
| Berkas | Untuk |
|---|---|
| `index.html` | Pelanggan. Tanpa parameter = **Price List** (hanya lihat). `?m=<kode>` dari QR meja = pesan & bayar |
| `staff.html` | Owner/Admin, Kasir, Kitchen/Barista (wajib login) |
| `antrean.html` | Layar TV nomor antrean |

## Konfigurasi
Satu-satunya yang perlu diisi: `js/config.js` → `GAS_URL` = URL Web App Apps Script yang berakhiran `/exec`.
Jangan menaruh kunci/sandi apa pun di repository ini — semua rahasia ada di Script Properties server.

## Struktur
```
index.html  staff.html  antrean.html  favicon.svg
css/style.css
js/config.js  core.js  qr.js  chart.js  xlsx.js
js/customer.js  staff.js  admin.js  antrean.js
```
Tanpa framework, tanpa build. Semua ikon, QR, grafik, dan ekspor Excel dibuat sendiri (tidak bergantung CDN selain Google Fonts).

## Diagnostik
Di Console browser (F12): `CF.Perf.table()` menampilkan waktu tiap panggilan server.

Panduan lengkap: **PANDUAN-INSTALASI.md**.
