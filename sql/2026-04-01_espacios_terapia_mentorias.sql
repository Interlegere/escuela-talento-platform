create table if not exists public.espacios_acompanamiento (
  id bigserial primary key,
  actividad_slug text not null check (actividad_slug in ('mentorias', 'terapia')),
  participante_email text not null,
  participante_nombre text,
  admin_email text,
  estado text not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actividad_slug, participante_email)
);

create index if not exists espacios_acompanamiento_actividad_email_idx
  on public.espacios_acompanamiento (actividad_slug, participante_email);

create table if not exists public.espacios_mensajes (
  id bigserial primary key,
  espacio_id bigint not null references public.espacios_acompanamiento(id) on delete cascade,
  asunto text,
  autor_email text not null,
  autor_nombre text not null,
  autor_rol text not null check (autor_rol in ('admin', 'colaborador', 'participante')),
  contenido_texto text,
  contenido_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists espacios_mensajes_espacio_idx
  on public.espacios_mensajes (espacio_id, created_at);

create table if not exists public.espacios_recursos (
  id bigserial primary key,
  espacio_id bigint not null references public.espacios_acompanamiento(id) on delete cascade,
  titulo text not null,
  descripcion text,
  recurso_tipo text not null default 'enlace',
  url text not null,
  visible boolean not null default true,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists espacios_recursos_espacio_idx
  on public.espacios_recursos (espacio_id, visible, created_at desc);

create table if not exists public.espacios_accesos_extra (
  id bigserial primary key,
  espacio_id bigint not null references public.espacios_acompanamiento(id) on delete cascade,
  actividad_destino_slug text not null check (actividad_destino_slug in ('casatalentos', 'conectando-sentidos')),
  habilitado boolean not null default false,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (espacio_id, actividad_destino_slug)
);

create index if not exists espacios_accesos_extra_espacio_idx
  on public.espacios_accesos_extra (espacio_id, actividad_destino_slug);
