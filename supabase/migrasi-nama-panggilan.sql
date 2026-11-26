-- Nama panggilan siswa: diisi lewat popup "Kami bisa memanggilmu siapa?"
-- yang muncul setelah daftar (atau saat masuk jika belum diisi).
-- Dipakai untuk sapaan "Halo, <nama panggilan>" di aplikasi.
alter table public.profiles
  add column if not exists nickname text;

alter table public.profiles
  drop constraint if exists profiles_nickname_panjang;
alter table public.profiles
  add constraint profiles_nickname_panjang
  check (nickname is null or char_length(btrim(nickname)) between 1 and 30);
