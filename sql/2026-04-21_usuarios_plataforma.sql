create extension if not exists pgcrypto;

create table if not exists public.usuarios_plataforma (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text,
  email text not null unique,
  whatsapp text,
  fecha_cumpleanos date,
  role text not null default 'participante'
    check (role in ('admin', 'colaborador', 'participante')),
  password_hash text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists usuarios_plataforma_email_idx
  on public.usuarios_plataforma (email);

create index if not exists usuarios_plataforma_role_idx
  on public.usuarios_plataforma (role);

create index if not exists usuarios_plataforma_fecha_cumpleanos_idx
  on public.usuarios_plataforma (fecha_cumpleanos);

alter table public.usuarios_plataforma enable row level security;
