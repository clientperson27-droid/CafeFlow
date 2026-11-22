# Panduan Instalasi CafeFlow v1.0.2
### Smart Cafe POS, QR Ordering & Price List (Cafe + Steam)

Panduan ini ditulis untuk Anda yang **belum pernah** memakai Google Apps Script maupun GitHub. Ikuti tahap demi tahap. Jangan lompati tahap, dan catat setiap hasil yang diminta untuk dicatat.

---

## 0. Isi paket

| Berkas | Untuk apa | Dipasang di mana |
|---|---|---|
| `Kode.gs` | Server/otak aplikasi (database, pembayaran, laporan) | Google Apps Script (disalin-tempel) |
| `appsscript.json` | Pengaturan izin & zona waktu server | Google Apps Script (disalin-tempel) |
| `cafeflow-frontend.zip` | Tampilan aplikasi (halaman pelanggan, staf, layar antrean) | GitHub Pages |
| `PANDUAN-INSTALASI.md` | Panduan ini (salinannya juga ada di dalam ZIP) | — |

Setelah terpasang, Anda punya **3 alamat**:

| Alamat | Dipakai oleh | Keterangan |
|---|---|---|
| `https://USERNAME.github.io/NAMA-REPO/` | Pelanggan | Tanpa QR meja = **Price List** (hanya lihat harga cafe + steam). Dari QR meja = pesan & bayar |
| `https://USERNAME.github.io/NAMA-REPO/staff.html` | Owner, Kasir, Dapur | Wajib login. Tiap peran melihat menu berbeda |
| `https://USERNAME.github.io/NAMA-REPO/antrean.html` | TV/monitor di cafe | Nomor antrean & panggilan, tanpa data pribadi |

> **Yang Anda butuhkan:** 1 akun Google (sebaiknya akun khusus usaha), 1 akun GitHub (gratis), komputer Windows/Mac, ±45 menit.

---

## TAHAP A — Memasang Server (Google Apps Script)

### A1. Buat proyek
1. Buka **https://script.google.com** dengan akun Google usaha Anda → **Proyek baru**.
2. Klik judul "Proyek tanpa judul" di kiri atas → ganti menjadi **CafeFlow** → OK.

### A2. Tampilkan berkas pengaturan
1. Klik ikon **⚙️ Setelan Proyek** di bilah kiri.
2. Centang **"Tampilkan file manifes 'appsscript.json' di editor"**.

### A3. Tempel kode
1. Kembali ke **Editor** (ikon `< >`). Klik `appsscript.json` → hapus semua isinya → tempel seluruh isi berkas `appsscript.json` dari paket.
2. Klik `Kode.gs` → hapus semua isinya → tempel seluruh isi berkas `Kode.gs` dari paket.
3. Tekan **Ctrl+S** (Mac: Cmd+S) untuk menyimpan. Pastikan tidak ada pesan error merah.

### A4. Jalankan setup (sekali saja)
1. Di bilah atas editor, pada daftar fungsi pilih **`setupAppEnvironment`** → klik **▶ Jalankan**.
2. Google meminta izin. Klik **Tinjau izin** → pilih akun Anda → muncul "Google belum memverifikasi aplikasi ini" → klik **Lanjutan** → **Buka CafeFlow (tidak aman)** → **Izinkan**.
   > Ini normal untuk skrip buatan sendiri. Izin dipakai untuk membuat spreadsheet, menyimpan foto ke Drive, mengirim email struk, dan menghubungi Midtrans.
3. Tunggu ±30–60 detik sampai **Log eksekusi** menampilkan `✅ SETUP SELESAI`.

### A5. ⚠️ Catat kata sandi dari log — hanya tampil sekali
Log berisi seperti ini (kata sandi Anda berbeda):

```
👤 AKUN STAF AWAL (catat sekarang — kata sandi sementara, wajib diganti saat login pertama):
   ADMIN → username: owner | kata sandi: XXXXXXXXXX
   KASIR → username: kasir | kata sandi: XXXXXXXXXX
   DAPUR → username: dapur | kata sandi: XXXXXXXXXX
🔐 AKSES DARURAT (catat sekarang — hanya tampil sekali, ganti setelah login pertama)
   Nama pengguna : darurat
   Kata sandi    : XXXXXXXXXXXXXXXX
```

Salin keempatnya ke tempat aman (buku catatan atau pengelola kata sandi). Akses **darurat** dipakai hanya bila akun owner terkunci/lupa sandi.

Setup juga membuat:
- Folder Drive **CafeFlow** berisi spreadsheet database, folder foto menu, folder bukti transfer (privat), laporan, dan backup.
- Data contoh: 19 menu, 6 kategori, 15 meja (01–15), 10 layanan steam di Price List, 9 bahan stok, 2 promo. Semua bisa diubah/hapus dari dashboard.
- Jadwal otomatis: pemanas server tiap 1 menit, rekap harian 23.45, backup harian 03.00 (menyimpan 30 backup terakhir).

> Menjalankan `setupAppEnvironment` lagi **aman** — tidak menimpa data, kata sandi, maupun kunci rahasia yang sudah ada.

### A6. Terbitkan sebagai Web App
1. Klik **Terapkan (Deploy)** → **Deployment baru**.
2. Klik ikon ⚙️ di sebelah "Pilih jenis" → **Aplikasi web**.
3. Isi:
   - **Deskripsi:** `v1.0.0`
   - **Jalankan sebagai:** **Saya** (email Anda)
   - **Yang memiliki akses:** **Siapa saja** (Anyone)
4. Klik **Terapkan** → salin **URL aplikasi web** yang berakhiran **`/exec`**.
5. Uji: tempel URL itu di tab browser baru. Harus tampil teks seperti `{"ok":true,"data":{"app":"CafeFlow API",...}}`.

> **"Siapa saja" aman.** Pelanggan memang harus bisa memesan tanpa login. Data staf tetap dijaga kata sandi + token yang diperiksa server di setiap permintaan.

---

## TAHAP B — Memasang Tampilan (GitHub Pages)

### B1. Ekstrak ZIP dan isi alamat server
1. Klik kanan `cafeflow-frontend.zip` → **Extract All / Ekstrak Semua**. Muncul folder **`cafeflow-frontend`**.
2. Buka folder itu. **Baris teratas harus berisi `index.html`**, lalu `staff.html`, `antrean.html`, folder `css` dan `js`. Inilah folder yang akan dikirim ke GitHub — jangan naik/masuk satu level.
3. Buka `js\config.js` dengan **Notepad** → ganti teks `https://script.google.com/macros/s/GANTI_DENGAN_ID_DEPLOYMENT/exec` dengan URL `/exec` dari Tahap A6 (tetap di dalam tanda kutip) → Simpan.

```js
window.APP_CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfy.....panjang...../exec'
};
```

> Hanya URL ini yang boleh ada di frontend. Jangan pernah menaruh Server Key Midtrans, kata sandi, atau token apa pun di folder ini — repository GitHub Pages bersifat publik.

### B2. Pasang Git & siapkan identitas (sekali saja)
1. **Windows:** unduh & pasang dari https://git-scm.com/download/win (klik Next sampai selesai). **Mac:** buka Terminal, ketik `git --version` lalu ikuti tawaran instalasi.
2. Buka **PowerShell** (Windows) atau **Terminal** (Mac), jalankan satu per satu:

```bash
git --version
git config --global user.name "Nama Anda"
git config --global user.email "email-akun-github@contoh.com"
```

### B3. Buat repository di GitHub
1. Daftar/masuk di https://github.com. Username Anda akan menjadi bagian alamat situs (`username.github.io`).
2. Tombol **+** (kanan atas) → **New repository** → nama misalnya `cafeflow` → pilih **Public** → **jangan** centang README/.gitignore/license → **Create repository**. Biarkan halamannya terbuka.

### B4. Kirim folder ke GitHub lewat terminal
> ❌ Jangan memakai tombol "Upload files" di web GitHub — struktur folder `css/` dan `js/` akan rusak dan situs tampil tanpa desain.

1. Buka folder `cafeflow-frontend` di File Explorer → klik kolom alamat → ketik `powershell` → Enter. PowerShell terbuka tepat di folder itu.
2. Ketik `dir`. **Wajib terlihat `index.html`** di daftar. Kalau yang terlihat justru folder `cafeflow-frontend`, ketik `cd cafeflow-frontend` dulu.
3. Jalankan **satu per satu**, perhatikan hasilnya:

```bash
git init
git add .
git commit -m "CafeFlow v1.0.0"
git branch -M main
git remote add origin https://github.com/USERNAME/cafeflow.git
git push -u origin main
```

- Perhatikan **titik** di akhir `git add .`
- Ganti `USERNAME` dan `cafeflow` dengan milik Anda.
- Saat `git push` meminta **Password**, yang diisi adalah **Personal Access Token**, bukan sandi GitHub:
  1. Buka https://github.com/settings/tokens → **Generate new token (classic)**
  2. Note: `cafeflow` • Expiration: 90 days • centang **repo** → **Generate token**
  3. Salin token `ghp_...` (hanya tampil sekali) → tempel di terminal (klik kanan untuk tempel) → Enter.
  > Saat menempel, layar **tidak menampilkan apa pun** — itu normal.
- Berhasil bila muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

### B5. Aktifkan GitHub Pages
1. Di halaman repository: **Settings** → **Pages** (menu kiri).
2. Source: **Deploy from a branch** • Branch: **main** • folder **/ (root)** → **Save**.
3. Tunggu 1–2 menit, refresh. Muncul **"Your site is live at https://USERNAME.github.io/cafeflow/"**. Centang **Enforce HTTPS** bila tersedia.
4. Buka alamat itu → harus tampil halaman **Price List**.

---

## TAHAP C — Pengaturan Awal (±15 menit)

Buka `https://USERNAME.github.io/cafeflow/staff.html` → masuk sebagai **owner** dengan sandi dari Tahap A5 → buat sandi baru (min. 8 karakter, huruf + angka).

| Urutan | Menu | Yang diisi |
|---|---|---|
| 1 | **Pengaturan → Pembayaran & Situs** | **Alamat situs pelanggan** → klik *Pakai alamat saat ini* (atau isi `https://USERNAME.github.io/cafeflow`) → **Simpan**. Wajib — dipakai QR meja |
| 2 | Pengaturan → Identitas Aplikasi | Nama cafe, tagline, logo (otomatis dipangkas persegi), warna utama & aksen (ada cek kontras + pratinjau), alamat, telepon, jam buka |
| 3 | Pengaturan → Pembayaran & Situs | Centang metode yang dipakai; isi rekening transfer; unggah gambar **QRIS statis** dari bank Anda |
| 4 | Pengaturan → Pajak & Struk | Pajak default **0% (tanpa PPN)** — baris pajak tidak tampil di mana pun. Isi bila suatu saat diperlukan. Juga: biaya layanan, ukuran kertas printer (58/80 mm), pesan bawah struk, email owner untuk ringkasan malam |
| 5 | Pengaturan → Sesi Meja & Diskon | Wajib PIN meja (disarankan **ON**), batas diskon kasir, tahan pesanan di dapur sampai lunas |
| 6 | **Menu & Kategori** | Ganti data contoh dengan menu asli, foto, harga, opsi (level pedas, gula, topping) |
| 7 | **Price List** | Layanan steam (motor, mobil, perawatan) + harga. Tombol **Cetak** QR Price List untuk ditempel di area steam/kasir |
| 8 | **Meja & QR Code** | Sesuaikan jumlah meja → **Cetak Semua QR** (atau unduh PNG per meja) → laminasi & tempel |
| 9 | **Pengguna & Hak Akses** | Buat akun untuk tiap kasir/barista (jangan berbagi satu akun). Sandi sementara tampil sekali |
| 10 | **Pengaturan → Pop-up Sambutan** | Gambar promosi, ucapan selamat datang, label "Cafe & Car Wash" — lihat pratinjaunya langsung |
| 11 | Stok Bahan, Promo & Voucher | Opsional |

> Akun bawaan `kasir` dan `dapur` juga wajib mengganti sandi saat pertama login.

### Pop-up sambutan
Saat pelanggan scan **QR meja** atau **QR Price List**, muncul pop-up berisi gambar promosi, logo, ucapan *"Selamat Datang di … — Cafe & Car Wash"*, promo yang ditandai "Tampil", lalu dua pilihan besar:
- dari QR meja: **Pesan Makanan & Minuman** atau **Price List Car Wash**;
- dari QR Price List: **Lihat Harga Car Wash** atau **Lihat Menu Cafe**.

Pop-up muncul **sekali per hari per HP** (tidak mengganggu saat pelanggan memesan lagi) dan bisa ditutup dengan tombol ✕. Atur teks, gambar (disarankan mendatar ±1200 × 800), dan saklar on/off di **Pengaturan → Pop-up Sambutan** — pratinjaunya berubah langsung saat Anda mengetik. Tanpa gambar, pop-up memakai warna utama dengan ikon kopi & mobil.

### Fitur Price List (hanya lihat, untuk promosi)
- Pelanggan yang scan **QR Price List** (atau membuka alamat utama tanpa QR meja) melihat daftar harga **layanan steam** dan menu cafe, promo yang ditandai "Tampil", serta info cafe. **Tidak ada tombol pesan maupun bayar.**
- Pelanggan yang scan **QR meja** juga punya tab **Price List** di samping tab Menu, sehingga sambil menunggu kendaraan dicuci mereka bisa melihat harga steam.
- Atur judul, sub-judul, catatan, dan tampil/tidaknya menu cafe di **Pengaturan → Price List & Promo**.

---

## TAHAP D — Pembayaran Otomatis Midtrans (opsional)

Tanpa Midtrans, aplikasi sudah bisa menerima: **bayar di kasir** (tunai/debit/kredit/QRIS kasir), **transfer manual + bukti**, dan **QRIS statis + bukti** (diverifikasi kasir di menu *Verifikasi Pembayaran*). Midtrans menambah **QRIS dinamis, GoPay, ShopeePay, dan Virtual Account BCA/BNI/BRI** yang terkonfirmasi otomatis.

### D1. Ambil Server Key Sandbox (uji coba, uang tidak sungguhan)
1. Daftar/masuk di https://dashboard.midtrans.com. Sandbox dan Production dibuka dari alamat yang sama.
2. Pastikan pilihan **Environment** di bagian atas dashboard = **Sandbox**.
3. **Settings → Access Keys** → salin **Server Key** (Sandbox diawali `SB-Mid-server-`). Client Key dan Merchant ID **tidak** diperlukan.

### D2. Simpan di CafeFlow
1. **Pengaturan → Pembayaran & Situs** → pastikan **Mode = Sandbox (uji coba)**.
2. Tempel di kolom **Server Key** → **Simpan Server Key**. Label berubah menjadi "Server Key tersimpan" dan kunci hanya tampil tersamar.
3. **Tes koneksi** → harus muncul *"Terhubung ke Midtrans (sandbox)."* Bila muncul *"Server Key ditolak Midtrans"*, kunci salah salin atau mode tidak cocok.
4. Centang **QRIS dinamis, GoPay, ShopeePay, VA BCA/BNI/BRI** → **Simpan Perubahan** (tombol bawah). Pastikan **Alamat situs pelanggan** sudah terisi — GoPay/ShopeePay memakainya untuk kembali ke halaman pesanan.

### D3. Notification URL
Di Midtrans: **Settings → Payment → Notification URL → Payment notification URL** → tempel URL `/exec` Anda → **Save**.

> **Catatan jujur:** Midtrans tidak menerima jawaban *redirect* (301/302/303), sedangkan Google Apps Script selalu menjawab dengan redirect. Midtrans mungkin mengirim email peringatan *"Redirection status code … not supported"* dan mencoba mengirim ulang. **Pembayaran tetap tercatat**: CafeFlow sudah memproses notifikasi saat pertama diterima, kiriman ulang tidak menggandakan apa pun, dan CafeFlow juga mengecek status sendiri (±6 detik sekali selama halaman bayar pelanggan terbuka, dan tiap menit lewat jadwal otomatis). Bila email peringatan mengganggu, Notification URL boleh dikosongkan — konfirmasi tetap jalan lewat pengecekan otomatis selama `keepWarm` aktif.

### D4. Uji coba di Sandbox
Buka sesi meja, scan QR meja dari HP, pesan, lalu pilih pembayaran:
- **VA BCA** (paling mudah): salin nomor VA → buka https://simulator.sandbox.midtrans.com/bca/va/index → masukkan nomor → bayar. BNI: `…/bni/va/index`. BRI: https://simulator.sandbox.midtrans.com/openapi/va/index lalu pilih BRI.
- **GoPay di HP**: tombol buka GoPay otomatis membuka GoPay Simulator.
- **QRIS**: simulator QRIS (https://simulator.sandbox.midtrans.com/v2/qris/index) meminta link gambar QR. Alur konfirmasinya sama dengan VA, jadi uji VA/GoPay sudah mewakili.

Dalam beberapa detik pesanan berubah **Lunas** dan muncul di kasir & dapur.
> ⚠️ Jangan membayar transaksi Sandbox dengan aplikasi bank/e-wallet sungguhan — uang bisa tidak kembali.

### D5. Pindah ke Production (uang sungguhan)
1. Lengkapi data usaha di Midtrans sampai akun & metode pembayaran disetujui.
2. Ganti Environment Midtrans ke **Production** → **Settings → Access Keys** → salin Server Key Production (berbeda dari Sandbox).
3. Di CafeFlow: **Mode → Production** → **Simpan Perubahan** dulu, lalu tempel Server Key Production → **Simpan Server Key** → **Tes koneksi**.
4. Isi lagi Notification URL di dashboard Midtrans versi Production.
5. Uji satu transaksi kecil sungguhan sebelum dipakai pelanggan.

> Jangan mengirim Server Key lewat chat, WA, atau screenshot. Kunci Midtrans tidak bisa diganti sendiri — bila bocor, hubungi Support Midtrans.

---

## Alur Kerja Harian

1. **Kasir buka sesi meja** — menu *Meja & Sesi* → pilih meja → **Buka Sesi**. Bila PIN aktif, sebutkan PIN 4 angka ke pelanggan. QR meja hanya bisa dipakai memesan saat sesi aktif.
2. **Pelanggan scan QR meja** → pilih menu & opsi → **Pesan Sekarang** → pilih pembayaran. Beberapa HP di satu meja boleh memesan, dan boleh memesan lagi kapan pun.
3. **Pesanan masuk** di layar kasir dan dapur dengan bunyi notifikasi (klik ikon 🔊 sekali di awal shift agar suara aktif).
4. **Dapur** (tablet, akun `dapur`): Menunggu → **Mulai Proses** → **Siap Disajikan**. Nomor antrean otomatis tampil besar di **layar TV** (`antrean.html`) disertai bunyi.
5. **Kasir** menerima pembayaran di kasir/verifikasi bukti transfer, mencetak struk (printer thermal 58/80 mm lewat dialog cetak browser), memberi diskon (di atas batas → menunggu persetujuan owner).
6. **Tutup sesi** meja setelah pelanggan pergi. Bila masih ada tagihan, sistem meminta konfirmasi + alasan.
7. Pukul 23.45 rekap harian dibuat otomatis (dan dikirim ke email owner bila diaktifkan).

**Layar TV:** buka `antrean.html` di browser TV/PC mini → tekan **F11** (layar penuh) → klik layar sekali agar suara panggilan aktif.

---

## Menghapus Pesanan (khusus Owner/Admin)

Layar **Pesanan Masuk** membersihkan dirinya sendiri: tab **Aktif** hanya berisi pesanan yang belum selesai, dan pesanan yang sudah selesai & lunas hilang dari layar keesokan harinya (selama sesi mejanya sudah ditutup). Data aslinya tetap tersimpan untuk laporan. Fitur hapus dipakai untuk **data uji coba** atau **pesanan salah input**.

- **Satu pesanan:** buka detail pesanan (klik kartunya) → ikon 🗑 di kanan bawah. Atau dari **Laporan → Tabel** → ikon 🗑 di ujung baris (untuk pesanan hari-hari sebelumnya).
- **Banyak sekaligus:** **Pengaturan → Sistem → Hapus data pesanan** → pilih periode dan jenis (*hanya dibatalkan*, *belum/tidak lunas*, atau *semua*) → **Hitung dulu** → **Hapus**. Server otomatis membuat salinan spreadsheet di folder Backup sebelum menghapus.
- Setiap penghapusan wajib diberi alasan dan diketik **HAPUS**. Pesanan, item, transaksi, dan bukti transfernya dihapus permanen; jejaknya (siapa, kapan, isi pesanan, alasan) tetap tercatat di **Activity Log**.
- Menghapus pesanan **lunas** ikut mengurangi pendapatan di laporan. Pesanan yang belum diproses dapur mengembalikan stok porsinya.
- Kasir dan dapur **tidak bisa** menghapus — kasir cukup memakai **Batalkan**.
- **Saran sebelum buka resmi:** hapus semua pesanan uji coba lewat *Hapus data pesanan → Semua pesanan* pada tanggal-tanggal uji coba, supaya laporan mulai dari nol.
- Untuk data asli yang sudah berbulan-bulan, pakai **Arsipkan data lama** (data dipindah ke spreadsheet arsip, bukan dibuang).

---

## Menghapus Menu, Kategori & Item Price List

- **Menu & Kategori → tab Menu:** centang menu (atau centang kotak di judul tabel untuk memilih semua yang tampil) → **Hapus terpilih**. Satu menu: ikon 🗑 di ujung baris. Cocok untuk membuang **19 menu contoh** sekaligus sebelum memasukkan menu asli.
- **Tab Kategori:** ikon 🗑. Bila kategori masih berisi menu, Anda diminta memilih kategori tujuan — menunya dipindahkan dulu, baru kategorinya dihapus. Minimal harus tersisa 1 kategori.
- **Price List:** centang item (atau centang judul grup, mis. semua "Steam Motor") → **Hapus terpilih**.
- Riwayat pesanan & laporan lama **tetap utuh** (item pesanan menyimpan salinan nama & harga). Foto yang diunggah dari dashboard ikut dipindah ke sampah Google Drive (bisa dipulihkan 30 hari), kecuali masih dipakai item lain. Semua penghapusan tercatat di Activity Log.
- Ingin menyembunyikan sementara tanpa menghapus? Pakai **Arsip** (menu) atau matikan **Tampilkan** (price list).

---

## Pindah Data dari Aplikasi / Spreadsheet Lama (opsional)

Menu **Pengaturan → Import Data**:
1. Tempel URL spreadsheet lama (harus milik akun Google yang sama). Spreadsheet lama **hanya dibaca**, tidak diubah.
2. Centang data yang akan dipindah → **Pindai (dry-run)** untuk melihat berapa yang akan ditambah/diperbarui/dilewati.
3. **Jalankan Import**. Aman diulang — tidak ada data dobel.
4. **Tepat sebelum pindah total**, jalankan import sekali lagi untuk menangkap data terbaru.
5. Data dari Excel: simpan sebagai **CSV**, unduh templatnya di halaman yang sama, lalu **Import CSV**.

Kolom dikenali dari judulnya (mis. "Nama Menu", "Harga", "Kategori", "No HP"). Nomor HP yang kehilangan angka 0 di depan otomatis diperbaiki, dan link foto Google Drive otomatis diubah menjadi link gambar.

---

## Memperbarui Aplikasi

> **Catatan v1.0.2:** setelah `Kode.gs` versi ini dipasang, pajak otomatis diubah menjadi **0%** satu kali (tercatat di Activity Log atas nama "Sistem"). Bila kelak ingin memakai pajak lagi, isi di Pengaturan → Pajak & Struk — tidak akan dinolkan lagi.

**Server (Kode.gs baru):**
1. Simpan cadangan kode lama (salin ke Notepad).
2. Tempel `Kode.gs` baru → Simpan.
3. **Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan.**
   > ❌ Jangan "Deployment baru" — URL `/exec` akan berubah dan semua QR/`config.js` harus diganti.

**Tampilan:** ekstrak ZIP pembaruan (`update-tampilan-v…zip`, sengaja **tanpa** `js/config.js`), salin seluruh isinya ke folder `cafeflow-frontend`, pilih **Ganti file di tujuan**. Alamat server Anda di `js/config.js` tetap aman. Lalu dari PowerShell di folder itu:

```bash
git add .
git commit -m "Update CafeFlow"
git -c credential.helper= push
```

Saat diminta *Password*, tempel Personal Access Token dari akun pemilik repository.

Tunggu 1–2 menit, lalu tekan **Ctrl+Shift+R** di browser.

---

## Kecepatan, Kuota & Pemeliharaan

- **Pemanas otomatis (keepWarm)** berjalan tiap 1 menit agar respons tetap cepat di jam ramai. Pemakaiannya ±10–20 menit dari kuota trigger harian Google (akun Gmail biasa ±90 menit/hari; Google Workspace ±6 jam/hari). Bila perlu menghemat kuota, jalankan fungsi `matikanKeepWarm` di editor (nyalakan lagi dengan `nyalakanKeepWarm`).
- **Cek kesehatan server:** menu *Pengaturan → Sistem*, atau jalankan `cekPerforma` di editor.
- **Edit langsung di spreadsheet?** Bisa, tetapi tampilan memakai cache. Klik **Pengaturan → Sistem → Muat ulang data dari Google Sheets** setelahnya.
- **Data menumpuk** (ribuan pesanan): *Pengaturan → Sistem → Arsipkan data lama* memindahkan data lama ke spreadsheet arsip. Grafik & total laporan lama tetap utuh.
- **Backup:** salinan spreadsheet otomatis setiap pukul 03.00 di folder `Backup` (30 terakhir disimpan).
- **Kuota email Google:** ±100 email/hari untuk akun Gmail biasa (struk email + ringkasan harian).

## Keamanan

- Semua rahasia (Server Key Midtrans, kunci sesi, hash kata sandi) tersimpan di **Script Properties** server — tidak di kode, spreadsheet, maupun GitHub.
- **Jangan menambah editor** proyek Apps Script sembarangan: editor bisa melihat Script Properties.
- Fungsi darurat yang dijalankan dari editor:

| Fungsi | Kapan dipakai |
|---|---|
| `resetSandiOwner` | Owner lupa sandi → sandi sementara baru muncul di log |
| `resetAksesDarurat` | Sandi akses darurat hilang, atau setelah akses darurat dipakai |
| `rotasiSecretSesi` | Curiga ada yang menyalahgunakan login → semua staf keluar dan wajib login ulang |
| `tesKoneksiMidtrans` | Mengecek Server Key Midtrans |
| `arsipkanDataLama` | Mengarsipkan data > 3 bulan dari editor |

- Login salah 5× → akun terkunci 15 menit. Semua aksi sensitif (batal pesanan, ubah harga, diskon, koreksi stok, ubah pengaturan) tercatat di **Activity Log** dan tidak bisa diubah.
- QR meja dicurigai tersebar? **Meja & QR Code → Ganti QR** — QR lama langsung tidak berlaku.

---

## Kendala Umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| Halaman bertuliskan "Konfigurasi belum lengkap" | `js/config.js` masih berisi `GANTI_...` | Isi URL `/exec` (Tahap B1), lalu `git add .` → `commit` → `push` |
| Situs GitHub 404 "File not found" | Yang dikirim folder induk, bukan folder berisi `index.html` | Masuk ke folder yang berisi `index.html`, ulangi B4 lalu `git push -u origin main --force` |
| Situs tampil tanpa warna/desain | Struktur `css/` & `js/` rusak (upload lewat web) | Kirim ulang lewat terminal (B4) |
| "Koneksi terputus. Periksa internet Anda…" padahal internet lancar | URL `/exec` salah, atau akses deploy bukan "Siapa saja" | Cek A6. Buka URL `/exec` di browser harus tampil teks JSON |
| Perubahan kode server tidak berlaku | Lupa membuat versi deployment baru | Kelola deployment → Edit → Versi baru |
| Pelanggan melihat "Meja … belum aktif" | Sesi meja belum dibuka kasir | Kasir buka sesi di menu Meja & Sesi |
| QR meja membuka alamat yang salah | Alamat situs pelanggan belum diisi | Isi di Pengaturan → Pembayaran & Situs, lalu cetak ulang QR |
| Tidak ada bunyi pesanan baru | Browser memblokir suara sebelum ada klik | Klik ikon 🔊 / klik layar sekali di awal shift |
| Foto menu tidak tampil | File Drive tidak publik | Unggah ulang dari dashboard (otomatis dibuat publik) |
| `Password authentication is not supported` saat `git push` | GitHub butuh token | Buat Personal Access Token (B4) |
| Tampilan masih versi lama setelah update | Cache browser | Ctrl+Shift+R atau jendela Incognito |

---

## Batasan yang Perlu Anda Ketahui

- **Midtrans** sudah diuji dengan simulator (tanda tangan notifikasi, cek status, nominal, kedaluwarsa), **belum** ke server Midtrans sungguhan. Uji dulu di Sandbox sebelum Production.
- **Notifikasi** pesanan baru berbunyi selama halaman staf terbuka. Belum ada notifikasi push ke HP saat aplikasi ditutup.
- **Struk PDF & laporan PDF** dibuat server dalam beberapa detik. Untuk printer thermal gunakan tombol **Cetak** (dialog cetak browser).
- **Kapasitas:** dirancang untuk 15–20 meja, 100–150 pesanan/hari, 10–20 pesanan bersamaan. Google membatasi ±30 proses serentak per skrip, jauh di atas kebutuhan ini.
- **Sesi meja** berakhir otomatis setelah 3 jam tidak aktif (bisa diubah).
- Aplikasi harus dipasang di akun Google yang **sama** dengan spreadsheet lama bila Anda ingin mengimpor data lama.

---

## Ringkasan Hasil Uji (sebelum diserahkan)

- **392** uji server lulus (153 alur utama + 183 hapus pesanan & batas ukuran lembar + 56 fitur v1.0.2: tanpa PPN & penyesuaian otomatis, pop-up sambutan, hapus menu/kategori/price list): hitungan harga/promo/pajak/diskon, nomor pesanan & antrean, pesanan ganda (idempoten), injeksi rumus spreadsheet, normalisasi nomor HP, alur QRIS/VA/webhook (termasuk tanda tangan palsu & nominal berbeda), verifikasi transfer, batal + pengembalian stok, hak akses per peran, kunci login, PIN meja, banyak perangkat per meja, sesi kedaluwarsa, rekap/arsip, import ulang tanpa dobel, CSV, PDF, batch.
- **Uji browser** (Chrome, desktop + HP): pop-up sambutan, halaman pelanggan, Price List, pesan & bayar, kasir (diskon, terima tunai), dapur, layar TV, dashboard, laporan, menu, meja & QR, pengaturan, import, log, semua fitur hapus — **0 error JavaScript**. Total di layar = total di server.
- QR meja hasil cetak terbaca kamera (diuji dekoder OpenCV) dan membuka meja yang benar. File Excel laporan terbuka bersih.
- Server Key yang disimpan dari dashboard masuk ke Script Properties dan **tidak** muncul di spreadsheet.
