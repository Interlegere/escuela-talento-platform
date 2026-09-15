-- Interruptor de opt-out: cada participante puede pedir, en cualquier
-- momento y desde /perfil, que su material (grabaciones grupales) no se
-- comparta fuera de quienes estuvieron presentes en cada encuentro.
--
-- Tabla de solo inserción (append-only) — nunca se actualiza ni se borra
-- una fila. El estado vigente de una persona es su fila más reciente.
-- Sin filas para un email = "comparte" (el default).
--
-- No hace falta una tabla separada para el "sí" (compartir): ese
-- consentimiento ya queda registrado, con fecha, hora y versión de
-- Términos, en la tabla "consentimientos" al aceptar antes de cada
-- encuentro. Esta tabla solo registra cuándo alguien se sale o vuelve a
-- entrar a ese esquema por defecto.

create extension if not exists pgcrypto;

create table if not exists public.material_restricciones (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  accion text not null check (accion in ('restringe', 'levanta')),
  terminos_version text,
  created_at timestamptz not null default now()
);

create index if not exists material_restricciones_user_created_idx
  on public.material_restricciones (user_email, created_at desc);

alter table public.material_restricciones enable row level security;
revoke all privileges on public.material_restricciones from anon, authenticated;
