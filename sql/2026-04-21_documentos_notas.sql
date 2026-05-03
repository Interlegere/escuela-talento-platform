alter table public.usuarios_plataforma
  add column if not exists notas_documentos jsonb not null default '[]'::jsonb;

alter table public.disponibilidades
  add column if not exists notas_documentos jsonb not null default '[]'::jsonb;
