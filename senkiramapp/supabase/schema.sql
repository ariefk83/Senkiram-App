-- ============================================================
-- EduKids Assessment Platform — Supabase Schema (v2, tanpa Auth)
-- Jalankan seluruh file ini di Supabase SQL Editor (sekali saja)
-- ============================================================

-- ---------- KELAS (tetap, di-seed sekali di bawah) ----------
create table kelas (
  id uuid primary key default gen_random_uuid(),
  jenjang text not null check (jenjang in ('SD','SMP','SMA')),
  nomor int not null,
  unique (jenjang, nomor)
);

insert into kelas (jenjang, nomor) values
  ('SD',1), ('SD',2), ('SD',3), ('SD',4), ('SD',5), ('SD',6),
  ('SMP',1), ('SMP',2), ('SMP',3),
  ('SMA',1), ('SMA',2), ('SMA',3);

-- ---------- MATA PELAJARAN (dinamis, admin bisa tambah kapan saja) ----------
create table mata_pelajaran (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz default now()
);

-- ---------- MATERI (anak dari kelas + mata pelajaran) ----------
create table materi (
  id uuid primary key default gen_random_uuid(),
  kelas_id uuid references kelas(id) on delete cascade,
  mapel_id uuid references mata_pelajaran(id) on delete cascade,
  nama text not null,
  created_at timestamptz default now(),
  unique (kelas_id, mapel_id, nama)
);

-- ---------- SOAL (bank soal, reusable) ----------
create table soal (
  id uuid primary key default gen_random_uuid(),
  pertanyaan text not null,
  pilihan_a text not null,
  pilihan_b text not null,
  pilihan_c text not null,
  pilihan_d text not null,
  jawaban_benar text not null check (jawaban_benar in ('A','B','C','D')),
  pembahasan text,
  created_at timestamptz default now()
);

-- ---------- SOAL <-> MATERI (many-to-many, soal bisa dibawa ke mana pun) ----------
create table soal_materi (
  soal_id uuid references soal(id) on delete cascade,
  materi_id uuid references materi(id) on delete cascade,
  primary key (soal_id, materi_id)
);

-- ---------- ANAK (tanpa login) ----------
create table anak (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  created_at timestamptz default now()
);

-- ---------- QUIZ ----------
create table quiz (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  deskripsi text,
  batas_waktu_menit int, -- null = tanpa batas waktu
  kelas_id uuid references kelas(id), -- identitas kelas quiz ini, dipakai untuk filter dashboard/leaderboard
  created_at timestamptz default now()
);

-- ---------- QUIZ <-> SOAL ----------
create table quiz_soal (
  quiz_id uuid references quiz(id) on delete cascade,
  soal_id uuid references soal(id) on delete cascade,
  primary key (quiz_id, soal_id)
);

-- ---------- ASSIGNMENT (quiz yang di-assign ke anak tertentu, via link token) ----------
create table assignment (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quiz(id) on delete cascade,
  anak_id uuid references anak(id) on delete cascade,
  token text not null unique,
  skor numeric,
  jumlah_benar int,
  jumlah_soal int,
  jawaban_siswa jsonb,
  dikerjakan_at timestamptz,
  created_at timestamptz default now(),
  unique (quiz_id, anak_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- PENTING: platform ini TIDAK memakai Supabase Auth. Admin masuk lewat
-- gerbang password sederhana di browser (lihat js/config.js), bukan lewat
-- autentikasi sungguhan. Karena itu, semua tabel di bawah dibuat terbuka
-- penuh lewat anon key (RLS diaktifkan tapi kebijakannya mengizinkan semua).
-- Ini WAJAR untuk penggunaan internal keluarga, tapi bukan batas keamanan
-- yang sesungguhnya — siapa pun yang menemukan anon key & URL project bisa
-- baca/tulis data. Baca catatan keamanan lengkap di README sebelum dipakai
-- untuk hal yang lebih sensitif.

alter table kelas enable row level security;
alter table mata_pelajaran enable row level security;
alter table materi enable row level security;
alter table soal enable row level security;
alter table soal_materi enable row level security;
alter table anak enable row level security;
alter table quiz enable row level security;
alter table quiz_soal enable row level security;
alter table assignment enable row level security;

create policy "kelas_all" on kelas for all using (true) with check (true);
create policy "mapel_all" on mata_pelajaran for all using (true) with check (true);
create policy "materi_all" on materi for all using (true) with check (true);
create policy "soal_all" on soal for all using (true) with check (true);
create policy "soal_materi_all" on soal_materi for all using (true) with check (true);
create policy "anak_all" on anak for all using (true) with check (true);
create policy "quiz_all" on quiz for all using (true) with check (true);
create policy "quiz_soal_all" on quiz_soal for all using (true) with check (true);
create policy "assignment_all" on assignment for all using (true) with check (true);

-- ============================================================
-- MIGRASI (hanya jalankan ini kalau kamu SUDAH pernah menjalankan
-- schema.sql versi sebelumnya di project Supabase yang sama —
-- kalau ini instalasi baru, ABAIKAN bagian ini karena kolom sudah
-- termasuk di definisi tabel `quiz` di atas)
-- ============================================================
-- alter table quiz add column if not exists kelas_id uuid references kelas(id);

-- Kalau kamu sudah pernah menjalankan schema.sql versi sebelumnya (SMP/SMA
-- masih bernomor 7-9 / 10-12), jalankan ini untuk menyamakan ke penomoran
-- per-jenjang (SMP 1-3, SMA 1-3):
-- update kelas set nomor = nomor - 6 where jenjang = 'SMP';
-- update kelas set nomor = nomor - 9 where jenjang = 'SMA';

-- ============================================================
-- CATATAN
-- ============================================================
-- 1. Tabel `kelas` sudah di-seed otomatis (SD 1-6, SMP 7-9, SMA 10-12) —
--    tidak perlu ditambah lewat aplikasi.
-- 2. Mata pelajaran & materi bersifat dinamis, dikelola lewat halaman
--    Bank Soal di aplikasi.
-- 3. Satu soal bisa ditandai ke banyak materi sekaligus lewat `soal_materi`.
-- 4. Satu assignment = satu quiz + satu anak + satu token unik. Link bisa
--    dipakai berkali-kali; setiap pengerjaan menimpa (overwrite) skor,
--    jumlah_benar, jumlah_soal, jawaban_siswa, dan dikerjakan_at yang lama.
-- ============================================================
