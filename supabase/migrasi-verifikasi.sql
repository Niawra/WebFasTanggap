-- Migrasi verifikasi laporan FasTanggap.
-- Jalankan sekali di Supabase: SQL Editor > New query > tempel > Run.
--
-- Alur:
--   1. Siswa mengirim laporan -> website/aplikasi memanggil backend /api/verifikasi-laporan.
--   2. Backend meminta AI menilai: 'valid', 'ragu', atau 'asal'.
--   3. 'asal'  -> laporan disembunyikan (status ditolak) + pelapor dapat 1 peringatan.
--      'ragu'  -> laporan tetap tampil, diberi tanda agar dicek petugas.
--   4. Petugas juga bisa menandai laporan asal-asalan secara manual, atau memulihkannya.
--   5. Akun dengan 3 peringatan tidak bisa membuat laporan baru.

-- 1. Kolom baru --------------------------------------------------------------
alter table public.reports add column if not exists is_hidden boolean not null default false;
alter table public.reports add column if not exists ai_verdict text;   -- valid | ragu | asal
alter table public.reports add column if not exists ai_reason text;
alter table public.profiles add column if not exists warning_count int not null default 0;

-- 2. Catatan peringatan ------------------------------------------------------
create table if not exists public.report_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  report_id uuid references public.reports (id) on delete set null,
  reason text not null,
  source text not null default 'ai',  -- ai | petugas
  created_at timestamptz not null default now()
);
create index if not exists report_warnings_user_idx on public.report_warnings (user_id, created_at desc);

alter table public.report_warnings enable row level security;

drop policy if exists "peringatan_baca" on public.report_warnings;
create policy "peringatan_baca" on public.report_warnings for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'petugas')
  );
-- Tidak ada policy insert/update/delete: penulisan hanya lewat fungsi di bawah.

-- 3. Pembantu: apakah pemanggil petugas? ------------------------------------
create or replace function public.adalah_petugas()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role::text = 'petugas');
$$;

-- 4. Inti: sembunyikan laporan + beri peringatan -----------------------------
create or replace function public._sembunyikan_dan_peringatkan(p_id uuid, p_alasan text, p_sumber text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pelapor uuid;
begin
  perform set_config('fastanggap.izin', '1', true);
  select reporter_id into v_pelapor from public.reports where id = p_id and not is_hidden;
  if v_pelapor is null then
    return; -- sudah disembunyikan / tidak ada
  end if;

  update public.reports
     set is_hidden = true,
         status = 'ditolak',
         rejection_reason = 'Ditandai sebagai laporan asal-asalan: ' || coalesce(nullif(trim(p_alasan), ''), 'isi laporan tidak jelas.')
   where id = p_id;

  insert into public.report_warnings (user_id, report_id, reason, source)
  values (v_pelapor, p_id, coalesce(nullif(trim(p_alasan), ''), 'Laporan tidak jelas.'), p_sumber);

  update public.profiles set warning_count = warning_count + 1 where id = v_pelapor;
end;
$$;
revoke all on function public._sembunyikan_dan_peringatkan(uuid, text, text) from public, anon, authenticated;

-- 5. Dipanggil backend AI (dengan token pelapor) -----------------------------
-- Pelapor hanya bisa memengaruhi laporannya sendiri, dan hanya sekali (ai_verdict masih kosong).
create or replace function public.terapkan_verifikasi_ai(p_id uuid, p_verdict text, p_alasan text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pelapor uuid;
  v_verdict_lama text;
begin
  if p_verdict not in ('valid', 'ragu', 'asal') then
    raise exception 'Verdict tidak dikenal';
  end if;

  select reporter_id, ai_verdict into v_pelapor, v_verdict_lama from public.reports where id = p_id;
  if v_pelapor is null then
    raise exception 'Laporan tidak ditemukan';
  end if;
  if v_pelapor <> auth.uid() and not public.adalah_petugas() then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;
  if v_verdict_lama is not null then
    return v_verdict_lama; -- sudah pernah dinilai
  end if;

  perform set_config('fastanggap.izin', '1', true);
  update public.reports set ai_verdict = p_verdict, ai_reason = left(p_alasan, 300) where id = p_id;

  if p_verdict = 'asal' then
    perform public._sembunyikan_dan_peringatkan(p_id, p_alasan, 'ai');
  end if;
  return p_verdict;
end;
$$;

-- 6. Tombol petugas: tandai asal-asalan --------------------------------------
create or replace function public.tandai_asal(p_id uuid, p_alasan text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.adalah_petugas() then
    raise exception 'Hanya petugas' using errcode = '42501';
  end if;
  perform public._sembunyikan_dan_peringatkan(p_id, p_alasan, 'petugas');
end;
$$;

-- 7. Tombol petugas: pulihkan laporan (cabut peringatannya) ------------------
create or replace function public.pulihkan_laporan(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pelapor uuid;
  v_hapus int;
begin
  if not public.adalah_petugas() then
    raise exception 'Hanya petugas' using errcode = '42501';
  end if;

  perform set_config('fastanggap.izin', '1', true);
  update public.reports
     set is_hidden = false, status = 'menunggu_verifikasi', rejection_reason = null, ai_verdict = 'valid'
   where id = p_id and is_hidden
  returning reporter_id into v_pelapor;
  if v_pelapor is null then return; end if;

  delete from public.report_warnings where report_id = p_id;
  get diagnostics v_hapus = row_count;
  update public.profiles set warning_count = greatest(warning_count - v_hapus, 0) where id = v_pelapor;
end;
$$;

revoke all on function public.terapkan_verifikasi_ai(uuid, text, text) from public, anon;
revoke all on function public.tandai_asal(uuid, text) from public, anon;
revoke all on function public.pulihkan_laporan(uuid) from public, anon;
grant execute on function public.terapkan_verifikasi_ai(uuid, text, text) to authenticated;
grant execute on function public.tandai_asal(uuid, text) to authenticated;
grant execute on function public.pulihkan_laporan(uuid) to authenticated;
grant execute on function public.adalah_petugas() to authenticated;

-- 8. Blokir akun dengan 3 peringatan -----------------------------------------
create or replace function public.cegah_pelapor_diblokir()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if (select warning_count from public.profiles where id = new.reporter_id) >= 3 then
    raise exception 'AKUN_DIBLOKIR: Akunmu sudah mendapat 3 peringatan karena laporan asal-asalan, jadi tidak bisa membuat laporan baru. Hubungi petugas sarana.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_cegah_diblokir on public.reports;
create trigger reports_cegah_diblokir
  before insert on public.reports
  for each row execute function public.cegah_pelapor_diblokir();

-- 8b. Kolom verifikasi tidak bisa diubah langsung oleh siswa --------------
-- (mis. menghapus peringatan sendiri lewat update profiles, atau memunculkan lagi laporannya).
-- Hanya fungsi di atas (yang menyalakan fastanggap.izin) atau petugas yang boleh.
create or replace function public.jaga_kolom_verifikasi()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('fastanggap.izin', true), '') = '1' or public.adalah_petugas() then
    return new;
  end if;
  if tg_table_name = 'profiles' then
    new.warning_count := old.warning_count;
  else
    new.is_hidden := old.is_hidden;
    new.ai_verdict := old.ai_verdict;
    new.ai_reason := old.ai_reason;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_jaga_peringatan on public.profiles;
create trigger profiles_jaga_peringatan
  before update on public.profiles
  for each row execute function public.jaga_kolom_verifikasi();

drop trigger if exists reports_jaga_verifikasi on public.reports;
create trigger reports_jaga_verifikasi
  before update on public.reports
  for each row execute function public.jaga_kolom_verifikasi();

-- Laporan baru selalu mulai tanpa penilaian (tidak bisa disisipkan dari aplikasi).
create or replace function public.reset_kolom_verifikasi()
returns trigger
language plpgsql
as $$
begin
  new.is_hidden := false;
  new.ai_verdict := null;
  new.ai_reason := null;
  return new;
end;
$$;

drop trigger if exists reports_reset_verifikasi on public.reports;
create trigger reports_reset_verifikasi
  before insert on public.reports
  for each row execute function public.reset_kolom_verifikasi();

-- 9. Fungsi publik tidak menampilkan laporan yang disembunyikan -------------
create or replace function public.lacak_laporan(p_kode text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  select json_build_object(
    'code', r.code,
    'title', r.title,
    'description', r.description,
    'category', c.name,
    'location', l.name,
    'status', r.status,
    'priority', r.priority,
    'created_at', r.created_at,
    'history', coalesce((
      select json_agg(json_build_object('status', h.new_status, 'note', h.note, 'created_at', h.created_at) order by h.created_at)
      from public.report_status_history h where h.report_id = r.id), '[]'::json),
    'notes', coalesce((
      select json_agg(json_build_object('note', n.note, 'created_at', n.created_at) order by n.created_at)
      from public.report_notes n where n.report_id = r.id), '[]'::json)
  )
  from public.reports r
  join public.categories c on c.id = r.category_id
  join public.locations l on l.id = r.location_id
  where r.code = upper(trim(p_kode)) and not r.is_hidden;
$$;

create or replace function public.ringkasan_publik()
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  select json_build_object(
    'total', (select count(*) from public.reports where not is_hidden),
    'menunggu', (select count(*) from public.reports where not is_hidden and status = 'menunggu_verifikasi'),
    'diproses', (select count(*) from public.reports where not is_hidden and status = 'diproses'),
    'selesai', (select count(*) from public.reports where not is_hidden and status = 'selesai'),
    'ditolak', (select count(*) from public.reports where not is_hidden and status = 'ditolak'),
    'per_kategori', coalesce((
      select json_object_agg(category_id, n)
      from (select category_id, count(*) n from public.reports where not is_hidden group by category_id) x), '{}'::json),
    'kategori', coalesce((
      select json_agg(json_build_object('id', id, 'name', name) order by name)
      from public.categories where is_active), '[]'::json),
    'terbaru', coalesce((
      select json_agg(t) from (
        select r.code, r.title, r.status, r.created_at, r.category_id, c.name as category, l.name as location
        from public.reports r
        join public.categories c on c.id = r.category_id
        join public.locations l on l.id = r.location_id
        where not r.is_hidden
        order by r.created_at desc limit 6) t), '[]'::json)
  );
$$;

grant execute on function public.lacak_laporan(text) to anon, authenticated;
grant execute on function public.ringkasan_publik() to anon, authenticated;
