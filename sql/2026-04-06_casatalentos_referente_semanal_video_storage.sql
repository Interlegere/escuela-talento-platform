alter table public.casatalentos_referentes_semanales
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint;
