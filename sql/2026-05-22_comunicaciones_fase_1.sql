create table if not exists public.comunicacion_plantillas (
  id bigserial primary key,
  clave text not null unique,
  nombre text not null,
  tipo text not null,
  asunto text not null,
  html text,
  texto text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comunicacion_envios (
  id bigserial primary key,
  plantilla_id bigint null references public.comunicacion_plantillas(id) on delete set null,
  destinatario_email text not null,
  destinatario_nombre text,
  actividad_slug text,
  tipo text not null,
  asunto text not null,
  estado text not null,
  proveedor text,
  proveedor_id text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists comunicacion_envios_email_idx
  on public.comunicacion_envios (destinatario_email);

create index if not exists comunicacion_envios_created_at_idx
  on public.comunicacion_envios (created_at desc);

create index if not exists comunicacion_envios_estado_idx
  on public.comunicacion_envios (estado);

create index if not exists comunicacion_plantillas_clave_idx
  on public.comunicacion_plantillas (clave);

create index if not exists comunicacion_plantillas_activo_idx
  on public.comunicacion_plantillas (activo);
