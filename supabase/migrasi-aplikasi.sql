-- Migrasi untuk aplikasi Android FasTanggap + notifikasi WhatsApp (OpenWA).
-- Jalankan sekali di Supabase: SQL Editor > New query > tempel > Run.
-- Aman dijalankan ulang.

-- 1. Nomor WhatsApp di profil -------------------------------------------
-- Format 62xxxxxxxxxx (tanpa +). Diisi dari tab Akun di aplikasi.
alter table public.profiles add column if not exists phone text;

-- 2. Siapa yang memegang laporan -----------------------------------------
alter table public.reports add column if not exists assigned_to uuid references public.profiles (id);
alter table public.reports add column if not exists assigned_at timestamptz;

-- 3. Ambil tugas: hanya petugas PERTAMA yang berhasil ---------------------
-- UPDATE ... WHERE assigned_to IS NULL bersifat atomik: kalau dua petugas
-- menekan "Ambil" bersamaan, yang kedua tidak menemukan baris dan ditolak.
create or replace function public.ambil_tugas(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_peran text;
  v_oleh uuid;
  v_nama text;
begin
  select role into v_peran from public.profiles where id = auth.uid();
  if v_peran is distinct from 'petugas' then
    return json_build_object('ok', false, 'pesan', 'Hanya petugas yang bisa mengambil tugas.');
  end if;

  update public.reports
     set assigned_to = auth.uid(),
         assigned_at = now(),
         status = case when status::text = 'menunggu_verifikasi' then 'diproses' else status end
   where id = p_id
     and assigned_to is null
     and status::text in ('menunggu_verifikasi', 'diproses');

  if found then
    return json_build_object('ok', true, 'pesan', 'Tugas jadi milikmu.');
  end if;

  select r.assigned_to, p.full_name into v_oleh, v_nama
    from public.reports r
    left join public.profiles p on p.id = r.assigned_to
   where r.id = p_id;

  if v_oleh is null then
    return json_build_object('ok', false, 'pesan', 'Tugas ini sudah ditutup.');
  end if;
  return json_build_object('ok', false, 'pesan', 'Sudah diambil ' || coalesce(v_nama, 'petugas lain'), 'oleh', v_nama);
end;
$$;

-- 4. Nomor WA petugas penanganan, hanya untuk pelapor laporan itu ---------
create or replace function public.kontak_petugas(p_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.phone
    from public.reports r
    join public.profiles p on p.id = r.assigned_to
   where r.id = p_id
     and r.reporter_id = auth.uid();
$$;

revoke all on function public.ambil_tugas(uuid) from public;
revoke all on function public.kontak_petugas(uuid) from public;
grant execute on function public.ambil_tugas(uuid) to authenticated;
grant execute on function public.kontak_petugas(uuid) to authenticated;

-- 5. Realtime: aplikasi langsung tahu ada tugas baru / sudah diambil ------
do $$
begin
  alter publication supabase_realtime add table public.reports;
exception when duplicate_object then null;
end $$;

-- 6. Notifikasi WhatsApp lewat Edge Function "kabari-wa" ------------------
-- Database memanggil fungsi itu (pg_net), fungsi itu memanggil OpenWA.
create extension if not exists pg_net with schema extensions;

-- Satu baris pengaturan. RLS aktif tanpa policy = tidak bisa dibaca dari aplikasi.
create table if not exists public.konfigurasi_wa (
  id int primary key default 1 check (id = 1),
  url_fungsi text not null,
  rahasia text not null
);
alter table public.konfigurasi_wa enable row level security;

-- Isi setelah Edge Function di-deploy (lihat supabase/README-WA.md):
-- insert into public.konfigurasi_wa (url_fungsi, rahasia)
-- values ('https://gaxykcqqhsdigeviqosl.supabase.co/functions/v1/kabari-wa', 'GANTI-DENGAN-RAHASIA-ACAK')
-- on conflict (id) do update set url_fungsi = excluded.url_fungsi, rahasia = excluded.rahasia;

create or replace function public.kabari_wa()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  k public.konfigurasi_wa%rowtype;
  v_jenis text;
begin
  if tg_op = 'INSERT' then
    v_jenis := 'baru';
  elsif new.assigned_to is not null and old.assigned_to is null then
    v_jenis := 'diambil';
  elsif new.status::text = 'selesai' and old.status::text <> 'selesai' then
    v_jenis := 'selesai';
  else
    return new;
  end if;

  select * into k from public.konfigurasi_wa where id = 1;
  if not found then
    return new; -- WhatsApp belum disiapkan; laporan tetap tersimpan.
  end if;

  perform net.http_post(
    url := k.url_fungsi,
    body := jsonb_build_object('jenis', v_jenis, 'report_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-rahasia', k.rahasia)
  );
  return new;
end;
$$;

drop trigger if exists reports_kabari_wa on public.reports;
create trigger reports_kabari_wa
  after insert or update on public.reports
  for each row execute function public.kabari_wa();
