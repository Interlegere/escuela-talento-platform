alter table public.usuarios_plataforma
  add column if not exists apellido text,
  add column if not exists whatsapp text,
  add column if not exists fecha_cumpleanos date;

create index if not exists usuarios_plataforma_fecha_cumpleanos_idx
  on public.usuarios_plataforma (fecha_cumpleanos);

