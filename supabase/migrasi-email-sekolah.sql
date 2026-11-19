-- Pendaftaran akun baru hanya boleh memakai email sekolah: NIS@student.smktelkom-pwt.sch.id
-- Akun yang sudah ada (termasuk petugas) tidak terpengaruh.
-- Jalankan sekali di Supabase → SQL Editor.
create or replace function public.wajib_email_sekolah()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.email is null or new.email !~* '^[0-9]+@student\.smktelkom-pwt\.sch\.id$' then
    raise exception 'EMAIL_BUKAN_SEKOLAH: pakai email NIS@student.smktelkom-pwt.sch.id';
  end if;
  return new;
end;
$$;

drop trigger if exists wajib_email_sekolah on auth.users;
create trigger wajib_email_sekolah
  before insert on auth.users
  for each row execute function public.wajib_email_sekolah();

-- Catatan: akun petugas baru dibuat lewat Supabase Dashboard juga akan ditolak trigger ini.
-- Untuk membuat petugas baru, matikan sementara:
--   alter table auth.users disable trigger wajib_email_sekolah;
--   ... buat akun ...
--   alter table auth.users enable trigger wajib_email_sekolah;
