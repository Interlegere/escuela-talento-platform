alter table if exists public.casatalentos_mensajes
  add column if not exists activo boolean not null default true;

alter table if exists public.conectando_mensajes
  add column if not exists activo boolean not null default true;

alter table if exists public.espacios_mensajes
  add column if not exists activo boolean not null default true;

create index if not exists casatalentos_mensajes_activo_idx
  on public.casatalentos_mensajes (activo, created_at);

create index if not exists conectando_mensajes_activo_idx
  on public.conectando_mensajes (activo, created_at);

create index if not exists espacios_mensajes_activo_idx
  on public.espacios_mensajes (espacio_id, activo, created_at);
