alter table public.disponibilidades
  add column if not exists participante_email text,
  add column if not exists participante_nombre text;

create index if not exists disponibilidades_participante_email_idx
  on public.disponibilidades (participante_email);

create index if not exists disponibilidades_actividad_modo_participante_idx
  on public.disponibilidades (actividad_slug, modo, participante_email, fecha, hora);
