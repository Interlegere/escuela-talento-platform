-- Follow-up del Security Advisor de Supabase
-- Objetivo:
-- 1. cerrar la tabla public.grabaciones, que todavía quedó expuesta sin RLS
-- 2. corregir la advertencia de search_path mutable en public.set_updated_at
--
-- Nota importante:
-- Las entradas "RLS Enabled No Policy" que ves en Info no son un problema en esta
-- arquitectura. Justamente significan que las tablas quedaron cerradas por
-- defecto y sólo las opera el backend con service_role.

alter table if exists public.grabaciones enable row level security;
revoke all privileges on table public.grabaciones from anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
