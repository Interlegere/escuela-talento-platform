create table if not exists public.comunicacion_contactos (
  id bigserial primary key,
  email text not null unique,
  nombre text,
  apellido text,
  telefono text,
  origen text,
  etiquetas jsonb not null default '[]'::jsonb,
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comunicacion_contactos_email_idx
  on public.comunicacion_contactos (email);

create index if not exists comunicacion_contactos_activo_idx
  on public.comunicacion_contactos (activo);

create index if not exists comunicacion_contactos_created_at_idx
  on public.comunicacion_contactos (created_at desc);
