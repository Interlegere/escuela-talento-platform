create extension if not exists pgcrypto;

create table if not exists public.hdr_coordenadas (
  id uuid primary key default gen_random_uuid(),
  actividad_slug text not null,
  titulo text not null,
  descripcion text,
  orden integer not null default 0,
  activo boolean not null default true,
  alcance text not null check (alcance in ('global', 'individual')),
  participante_email text,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hdr_coordenadas_actividad_slug_check
    check (actividad_slug in ('casatalentos', 'conectando-sentidos', 'mentorias', 'terapia')),
  constraint hdr_coordenadas_alcance_email_check
    check (
      (alcance = 'global' and participante_email is null)
      or
      (alcance = 'individual' and participante_email is not null)
    )
);

create index if not exists hdr_coordenadas_actividad_idx
  on public.hdr_coordenadas (actividad_slug);

create index if not exists hdr_coordenadas_participante_idx
  on public.hdr_coordenadas (participante_email);

create table if not exists public.hdr_respuestas (
  id uuid primary key default gen_random_uuid(),
  coordenada_id uuid not null references public.hdr_coordenadas(id) on delete cascade,
  participante_email text not null,
  respuesta text,
  notas_personales text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coordenada_id, participante_email)
);

create index if not exists hdr_respuestas_participante_idx
  on public.hdr_respuestas (participante_email);

create table if not exists public.hdr_aportes (
  id uuid primary key default gen_random_uuid(),
  coordenada_id uuid not null references public.hdr_coordenadas(id) on delete cascade,
  participante_email text not null,
  autor_email text not null,
  autor_nombre text,
  contenido text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hdr_aportes_participante_idx
  on public.hdr_aportes (participante_email);

create index if not exists hdr_aportes_coordenada_idx
  on public.hdr_aportes (coordenada_id);

drop trigger if exists set_hdr_coordenadas_updated_at on public.hdr_coordenadas;
create trigger set_hdr_coordenadas_updated_at
before update on public.hdr_coordenadas
for each row execute function public.set_updated_at();

drop trigger if exists set_hdr_respuestas_updated_at on public.hdr_respuestas;
create trigger set_hdr_respuestas_updated_at
before update on public.hdr_respuestas
for each row execute function public.set_updated_at();

drop trigger if exists set_hdr_aportes_updated_at on public.hdr_aportes;
create trigger set_hdr_aportes_updated_at
before update on public.hdr_aportes
for each row execute function public.set_updated_at();

alter table if exists public.hdr_coordenadas enable row level security;
alter table if exists public.hdr_respuestas enable row level security;
alter table if exists public.hdr_aportes enable row level security;

revoke all privileges on table public.hdr_coordenadas from anon, authenticated;
revoke all privileges on table public.hdr_respuestas from anon, authenticated;
revoke all privileges on table public.hdr_aportes from anon, authenticated;
