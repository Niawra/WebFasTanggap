-- Migrasi tambahan untuk website FasTanggap.
-- Menambah nomor laporan (FT-YYMM-NNN) dan dua fungsi baca untuk pengunjung
-- yang belum login. Fungsi ini sengaja tidak membuka nama pelapor.

-- 1. Nomor laporan ---------------------------------------------------------
create sequence if not exists public.reports_code_seq;

alter table public.reports add column if not exists code text unique;

create or replace function public.set_report_code()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.code is null then
    new.code := 'FT-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMM') || '-'
                || lpad(nextval('public.reports_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists reports_set_code on public.reports;
create trigger reports_set_code
  before insert on public.reports
  for each row execute function public.set_report_code();

-- 2. Lacak satu laporan dengan nomornya -----------------------------------
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
  where r.code = upper(trim(p_kode));
$$;

-- 3. Ringkasan untuk beranda ----------------------------------------------
create or replace function public.ringkasan_publik()
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  select json_build_object(
    'total', (select count(*) from public.reports),
    'menunggu', (select count(*) from public.reports where status = 'menunggu_verifikasi'),
    'diproses', (select count(*) from public.reports where status = 'diproses'),
    'selesai', (select count(*) from public.reports where status = 'selesai'),
    'ditolak', (select count(*) from public.reports where status = 'ditolak'),
    'per_kategori', coalesce((
      select json_object_agg(category_id, n)
      from (select category_id, count(*) n from public.reports group by category_id) x), '{}'::json),
    'kategori', coalesce((
      select json_agg(json_build_object('id', id, 'name', name) order by name)
      from public.categories where is_active), '[]'::json),
    'terbaru', coalesce((
      select json_agg(t) from (
        select r.code, r.title, r.status, r.created_at, r.category_id, c.name as category, l.name as location
        from public.reports r
        join public.categories c on c.id = r.category_id
        join public.locations l on l.id = r.location_id
        order by r.created_at desc limit 6) t), '[]'::json)
  );
$$;

revoke all on function public.lacak_laporan(text) from public;
revoke all on function public.ringkasan_publik() from public;
grant execute on function public.lacak_laporan(text) to anon, authenticated;
grant execute on function public.ringkasan_publik() to anon, authenticated;
