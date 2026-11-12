-- Akun siswa baru langsung aktif tanpa konfirmasi email (mode demo/tugas).
-- Hapus trigger ini kalau ingin kembali memakai konfirmasi email.
create or replace function public.auto_confirm_email()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists auto_confirm_email on auth.users;
create trigger auto_confirm_email
  before insert on auth.users
  for each row execute function public.auto_confirm_email();

-- Akun petugas demo
update public.profiles
set role = 'petugas', full_name = 'Petugas Sarana'
where id = (select id from auth.users where email = 'petugas@fastanggap.test');
