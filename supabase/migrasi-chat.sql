-- Chat per laporan antara pelapor dan petugas.
create table if not exists public.report_messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists report_messages_report_idx on public.report_messages(report_id, created_at);

alter table public.report_messages enable row level security;

-- Baca: petugas semua, pelapor hanya chat laporannya sendiri.
create policy "chat_baca" on public.report_messages for select to authenticated
using (
  public.current_role() = 'petugas'
  or exists (select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid())
);

-- Kirim: pengirim harus diri sendiri, dan boleh mengakses laporan itu.
create policy "chat_kirim" on public.report_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    public.current_role() = 'petugas'
    or exists (select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid())
  )
);

-- Aktifkan realtime agar pesan muncul tanpa refresh.
alter publication supabase_realtime add table public.report_messages;

-- Hapus semua chat otomatis saat laporan ditutup (selesai atau ditolak).
create or replace function public.hapus_chat_laporan_tutup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('selesai', 'ditolak') and old.status is distinct from new.status then
    delete from public.report_messages where report_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists hapus_chat_saat_tutup on public.reports;
create trigger hapus_chat_saat_tutup
after update of status on public.reports
for each row execute function public.hapus_chat_laporan_tutup();
