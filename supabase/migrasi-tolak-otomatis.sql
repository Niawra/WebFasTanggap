-- migrasi-tolak-otomatis.sql
-- Mengganti alur "laporan asal-asalan":
--   SEBELUM: AI/petugas menandai asal -> laporan disembunyikan + pelapor dapat peringatan,
--            3 peringatan -> akun diblokir membuat laporan.
--   SESUDAH: AI menilai asal -> laporan langsung berstatus DITOLAK dengan alasan dari AI.
--            Tidak ada laporan yang disembunyikan, tidak ada peringatan, tidak ada blokir.
--            Tombol petugas "tandai asal-asalan" dihapus (petugas cukup memakai Tolak biasa).
-- Aman dijalankan berulang. Jalankan di Supabase -> SQL Editor.

-- 1. Verdict AI: asal -> ditolak --------------------------------------------
create or replace function public.terapkan_verifikasi_ai(p_id uuid, p_verdict text, p_alasan text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pelapor uuid;
  v_verdict_lama text;
  v_status text;
begin
  if p_verdict not in ('valid', 'ragu', 'asal') then
    raise exception 'Verdict tidak dikenal';
  end if;

  select reporter_id, ai_verdict, status::text into v_pelapor, v_verdict_lama, v_status
    from public.reports where id = p_id;
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

  -- Hanya laporan yang masih menunggu yang ditolak otomatis.
  if p_verdict = 'asal' and v_status = 'menunggu_verifikasi' then
    update public.reports
       set status = 'ditolak',
           rejection_reason = 'Ditolak otomatis oleh TanggapAI: '
             || coalesce(nullif(trim(p_alasan), ''), 'isi laporan tidak jelas atau bukan kerusakan fasilitas.')
     where id = p_id;
  end if;
  return p_verdict;
end;
$$;
revoke all on function public.terapkan_verifikasi_ai(uuid, text, text) from public, anon;
grant execute on function public.terapkan_verifikasi_ai(uuid, text, text) to authenticated;

-- 2. Hapus blokir akun --------------------------------------------------------
drop trigger if exists reports_cegah_diblokir on public.reports;
drop function if exists public.cegah_pelapor_diblokir();

-- 3. Tombol petugas "tandai asal-asalan": cukup menolak laporan --------------
-- Tidak menyembunyikan laporan dan tidak memberi peringatan ke pelapor.
create or replace function public.tandai_asal(p_id uuid, p_alasan text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.adalah_petugas() then
    raise exception 'Hanya petugas yang bisa menandai laporan' using errcode = '42501';
  end if;
  perform set_config('fastanggap.izin', '1', true);
  update public.reports
     set status = 'ditolak',
         ai_verdict = coalesce(ai_verdict, 'asal'),
         rejection_reason = 'Ditandai asal-asalan oleh petugas: '
           || coalesce(nullif(trim(p_alasan), ''), 'isi laporan tidak jelas atau tidak sesuai.')
   where id = p_id;
  if not found then
    raise exception 'Laporan tidak ditemukan';
  end if;
end;
$$;
revoke all on function public.tandai_asal(uuid, text) from public, anon;
grant execute on function public.tandai_asal(uuid, text) to authenticated;

-- Tombol "pulihkan" tidak dibutuhkan lagi (tidak ada yang disembunyikan).
drop function if exists public.pulihkan_laporan(uuid);
drop function if exists public._sembunyikan_dan_peringatkan(uuid, text, text);

-- 4. Bereskan data lama -------------------------------------------------------
-- Laporan yang dulu disembunyikan kembali terlihat (statusnya tetap ditolak),
-- peringatan dihapus, dan hitungan peringatan semua akun kembali 0.
select set_config('fastanggap.izin', '1', false);
update public.reports set is_hidden = false where is_hidden;
delete from public.report_warnings;
update public.profiles set warning_count = 0 where warning_count <> 0;
select set_config('fastanggap.izin', '', false);
