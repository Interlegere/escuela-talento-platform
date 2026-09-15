-- Botón de Arrepentimiento y Botón de Baja de servicio (Disposición 954/2025).
-- Misma tabla para los dos, distinguidos por "tipo" — el código que se le
-- muestra a la persona lleva el prefijo ARR- o BAJA- según corresponda.
create extension if not exists pgcrypto;

create table if not exists public.arrepentimientos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('arrepentimiento','baja')),
  codigo text not null unique,
  nombre text not null,
  email text not null,
  actividad text,
  motivo text,
  resuelto boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists arrepentimientos_created_at_idx
  on public.arrepentimientos (created_at desc);

-- Mismo endurecimiento que sql/2026-04-26_hardening_rls_public.sql: la app
-- opera exclusivamente vía service_role desde el backend, así que RLS queda
-- habilitado sin policies (deny-by-default para anon/authenticated).
alter table public.arrepentimientos enable row level security;
revoke all privileges on table public.arrepentimientos from anon, authenticated;
