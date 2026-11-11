-- Skema FasTanggap untuk Supabase.
-- Jalankan di Supabase: SQL Editor > New query > tempel > Run.

create table if not exists public.kategori (
  id      text primary key,
  nama    text not null,
  contoh  text default ''
);

create table if not exists public.lokasi (
  nama text primary key
);

create table if not exists public.laporan (
  kode           text primary key,
  judul          text not null,
  kategori_id    text,
  lokasi         text not null,
  deskripsi      text not null,
  foto           text default '',
  prioritas      text default '',
  status         text not null default 'menunggu'
                 check (status in ('menunggu','diproses','selesai','ditolak')),
  dibuat         timestamptz not null default now(),
  pelapor_id     text,
  pelapor_nama   text,
  pelapor_kelas  text,
  riwayat        jsonb not null default '[]'::jsonb
);

create index if not exists laporan_dibuat_idx on public.laporan (dibuat desc);

-- Mode demo: siapa pun dengan anon key boleh baca/tulis.
-- Untuk dipakai sungguhan, ganti dengan Supabase Auth + policy per peran.
alter table public.kategori enable row level security;
alter table public.lokasi   enable row level security;
alter table public.laporan  enable row level security;

drop policy if exists demo_all on public.kategori;
drop policy if exists demo_all on public.lokasi;
drop policy if exists demo_all on public.laporan;
create policy demo_all on public.kategori for all to anon using (true) with check (true);
create policy demo_all on public.lokasi   for all to anon using (true) with check (true);
create policy demo_all on public.laporan  for all to anon using (true) with check (true);
