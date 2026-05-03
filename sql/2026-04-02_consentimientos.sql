create extension if not exists pgcrypto;

create table if not exists public.consentimientos (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  actividad text not null,
  aceptado boolean not null default true,
  version text not null,
  created_at timestamptz not null default now()
);

-- Ya no usamos unicidad sólo por usuario + actividad + versión, porque el
-- consentimiento actual se registra por encuentro/videollamada.
drop index if exists public.consentimientos_user_actividad_version_idx;

create index if not exists consentimientos_actividad_created_at_idx
  on public.consentimientos (actividad, created_at desc);

create index if not exists consentimientos_user_email_idx
  on public.consentimientos (user_email);
