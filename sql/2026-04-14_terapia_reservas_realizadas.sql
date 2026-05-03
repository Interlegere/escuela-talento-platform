alter table public.reservas
  add column if not exists realizada_at timestamptz,
  add column if not exists realizada_por_email text;

create index if not exists reservas_realizada_at_idx
  on public.reservas (realizada_at);
