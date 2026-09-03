-- Registro de cada consulta al buscador con IA de Entusiasmento (solo
-- lectura de lo propio, ver POST /api/entusiasmo/buscar) — para poder ver
-- después si se usa y para qué, no alimenta nada del buscador en sí.
create table if not exists public.entusiasmo_busquedas (
  id bigint generated always as identity primary key,
  participante_email text not null,
  pregunta text not null,
  respuesta text,
  created_at timestamptz not null default now()
);

create index if not exists entusiasmo_busquedas_participante_idx
  on public.entusiasmo_busquedas (participante_email, created_at desc);
