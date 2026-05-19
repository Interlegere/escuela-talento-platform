alter table public.disponibilidades
  add column if not exists serie_id text;

create index if not exists disponibilidades_serie_id_idx
  on public.disponibilidades (serie_id);
