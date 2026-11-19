-- Siswa boleh menghapus laporannya sendiri selama belum diambil petugas.
-- Jalankan sekali di Supabase → SQL Editor.
drop policy if exists "siswa_hapus_laporan_sendiri" on public.reports;
create policy "siswa_hapus_laporan_sendiri" on public.reports
  for delete to authenticated
  using (
    reporter_id = auth.uid()
    and status = 'menunggu_verifikasi'
    and assigned_to is null
  );
