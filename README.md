# EduKids — Platform Assessment Akademik (v2)

Platform internal untuk mengukur kemampuan akademik anak lewat bank soal dan quiz.
Dibangun dengan HTML/CSS/JS murni (tanpa build step), Supabase sebagai penyimpanan
data (tanpa Supabase Auth), dan fitur opsional extract soal dari PDF pakai Anthropic API.

## Update terbaru

- **Penomoran kelas diperbaiki:** SMP dan SMA sekarang bernomor 1-3
  (mengikuti sebutan sehari-hari "kelas 2 SMP", "kelas 3 SMA"), bukan lagi
  penomoran berkelanjutan 7-9/10-12. Dropdown kelas juga selalu menampilkan
  semua pilihan (SD 1-6, SMP 1-3, SMA 1-3) walau belum ada datanya.
  **Kalau kamu sudah pernah menjalankan `schema.sql` versi sebelumnya**,
  jalankan migrasi ini dulu di SQL Editor:
  ```sql
  update kelas set nomor = nomor - 6 where jenjang = 'SMP';
  update kelas set nomor = nomor - 9 where jenjang = 'SMA';
  ```
- **Card Nilai rata-rata dan Leaderboard dipisah** jadi dua kartu berdampingan.
- **Aksi cepat pindah ke baris judul**, sejajar dengan filter Jenjang/Kelas
  (tanpa card pembungkus). Di layar sempit, Aksi cepat mengecil jadi tombol
  "+", dan filter mengecil jadi tombol ikon corong — keduanya membuka panel
  kecil saat diketuk.

## Update sebelumnya

- **Tidak ada Supabase Auth sama sekali.** Admin masuk lewat password sederhana
  yang di-hardcode di `js/config.js`. Anak-anak tidak perlu login sama sekali.
- **Hirarki soal 5 level:** Jenjang → Kelas → Mata pelajaran → Materi → Soal.
  Satu soal bisa ditandai ke banyak materi sekaligus, dan bisa diedit,
  diduplikat, dipindah materi, atau dihapus.
- **Tiga cara menambah soal:** input manual, upload file `.md` (di-parse
  langsung di browser, tanpa AI, tanpa API key), atau upload PDF lewat AI
  (opsional, butuh API key Anthropic).
- **Quiz di-assign per anak.** Setelah quiz dibuat, admin memilih anak dari
  dropdown lalu sistem membuatkan link unik untuk anak itu. Link bisa dipakai
  berkali-kali — setiap pengerjaan menimpa nilai sebelumnya.
- **Anak tidak bisa melihat rekap nilai atau leaderboard.** Anak hanya melihat
  skor & review jawaban sesaat setelah selesai mengerjakan. Semua rekap dan
  leaderboard hanya ada di halaman admin.

## Fitur

- Bank soal reusable dengan hirarki Jenjang/Kelas/Mata pelajaran/Materi
- Aksi soal: tambah, edit, duplikat, pindah materi, hapus
- Import soal: manual, file `.md` (tanpa AI), atau PDF (AI, opsional)
- Quiz dengan batas waktu opsional, soal diacak otomatis tiap kali dibuka
- Assign quiz ke anak tertentu → link unik, bisa dipakai berkali-kali (re-write nilai)
- Anak: skor + review jawaban sesaat setelah selesai (tanpa rekap/leaderboard)
- Admin: dashboard ringkasan, rekap nilai lengkap, leaderboard keseluruhan

## 1. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel seluruh isi `supabase/schema.sql`, lalu jalankan (RUN).
   Ini membuat semua tabel, mengisi 12 baris `kelas` (SD 1-6, SMP 7-9, SMA 10-12),
   dan mengaktifkan Row Level Security dengan kebijakan terbuka (lihat catatan
   keamanan di bawah).
3. Buka **Project Settings > API**, salin `Project URL` dan `anon public key`.
4. Buka `js/config.js`, isi dengan kedua nilai tersebut, dan ganti `ADMIN_PASSWORD`
   sesuai keinginanmu:
   ```js
   export const SUPABASE_URL = "https://xxxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   export const ADMIN_PASSWORD = "passwordmu";
   ```

## 2. Deploy ke GitHub Pages

1. Push seluruh folder ini ke sebuah repository GitHub.
2. Buka **Settings > Pages** di repo tersebut.
3. Pilih source: branch `main`, folder `/ (root)`. Simpan.
4. Tunggu beberapa menit, situs akan aktif di `https://username.github.io/nama-repo/`.

## 3. Pemakaian sehari-hari

```
ADMIN
Buka situs → masukkan password admin (index.html)
  → Kelola anak: tambah nama anak-anak
  → Bank soal: tambah mata pelajaran & materi, lalu isi soal
    (manual / upload .md / upload PDF dengan AI)
  → Buat quiz: pilih soal → simpan → pilih anak dari dropdown → dapat link
  → Bagikan link ke anak (WhatsApp, dsb)
  → Nilai: pantau rekap & leaderboard semua anak

ANAK
Buka link quiz → langsung kerjakan (tanpa login)
  → soal otomatis diacak → submit
  → lihat skor & review jawaban saat itu juga
  → link bisa dibuka lagi kapan saja untuk mencoba ulang (nilai lama tertimpa)
```

## 4. Format file `.md` untuk import soal tanpa AI

Lihat juga contoh lengkap di `contoh-soal.md`. Formatnya:

```markdown
## Soal
Berapakah hasil dari 7 x 8?

- A. 48
- B. 54
- C. 56
- D. 63

Jawaban: C
Pembahasan: 7 dikali 8 sama dengan 56.

## Soal
Ibu kota Indonesia adalah...

- A. Bandung
- B. Jakarta
- C. Surabaya
- D. Medan

Jawaban: B
```

Baris `Pembahasan:` boleh dihilangkan kalau tidak ada. Ulangi blok `## Soal`
untuk setiap soal tambahan dalam satu file. Kamu bisa minta soal dalam format
ini dibuatkan, lalu tinggal salin ke file `.md` dan upload.

## 5. (Opsional) Aktifkan import soal PDF pakai AI

1. Dapatkan API key di [console.anthropic.com](https://console.anthropic.com).
2. Masuk sebagai admin, buka halaman **Pengaturan**, tempel API key, klik **Simpan**.
   Key hanya tersimpan di browser kamu (localStorage).
3. Buka **Bank soal > Import PDF (AI)**, upload file, klik **Extract dengan AI**,
   review hasilnya sebelum disimpan.
4. Kalau tidak ingin memakai fitur ini, cukup pakai **Manual** atau **Import .md**.
5. Biaya: sangat kecil (model Claude Haiku), estimasi di bawah $1/bulan untuk
   pemakaian rumahan biasa.

## Struktur file

```
index.html            Gerbang password admin
dashboard.html         Admin: ringkasan & leaderboard
bank-soal.html         Admin: kelola mapel/materi + soal (manual/md/AI) + edit/duplikat/pindah/hapus
buat-quiz.html         Admin: rakit quiz, assign ke anak, kelola link
kelola-anak.html       Admin: tambah/hapus anak
nilai.html             Admin: rekap nilai semua anak + leaderboard
settings.html          Admin: atur API key Anthropic (opsional)
quiz.html?token=xxx    Publik: anak kerjakan quiz lewat link unik, tanpa login
contoh-soal.md         Contoh format file import soal
css/style.css          Style bersama
js/                    Semua logic
supabase/schema.sql    Skema database + seed kelas + RLS
```

## Catatan keamanan (penting dibaca)

Platform ini didesain untuk **penggunaan internal keluarga**, bukan ujian
publik berisiko tinggi.

- **Password admin bukan autentikasi sungguhan.** Ini hanya gerbang di sisi
  browser (disimpan sebagai flag di localStorage setelah password benar).
  Siapa pun yang membuka source code (`js/config.js`) di GitHub repo publik
  bisa melihat passwordnya. Kalau repo kamu publik, siapa pun juga bisa
  melihat `SUPABASE_URL` dan anon key, lalu membaca/menulis data langsung
  lewat Supabase API tanpa lewat tampilan sama sekali. Untuk kebutuhan
  keluarga ini biasanya cukup aman, tapi jangan pakai untuk data sensitif
  atau ujian yang benar-benar berisiko.
- Kalau ingin sedikit lebih tertutup, jadikan repo GitHub **private** —
  catatan: GitHub Pages dari repo private butuh paket GitHub Pro/Team/Enterprise,
  jadi kalau memakai akun gratis, repo tetap perlu publik agar Pages aktif.
- Token link quiz (`quiz.html?token=xxx`) cukup panjang dan acak sehingga
  tidak mudah ditebak, tapi tidak dienkripsi — siapa pun yang tahu link bisa
  mengerjakan quiz atas nama anak tersebut.
- API key Anthropic tersimpan di localStorage browser admin — kalau pakai
  perangkat berbeda, perlu isi ulang di halaman Pengaturan.

## Pengembangan lanjutan (ide)

- Import/ekspor bank soal antar keluarga atau backup
- Statistik penguasaan per materi untuk tiap anak
- Riwayat semua percobaan per assignment (bukan hanya nilai terakhir)
- Batasi repo tetap publik namun rotasi anon key secara berkala
