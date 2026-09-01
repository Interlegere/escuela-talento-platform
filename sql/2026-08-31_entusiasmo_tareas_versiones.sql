-- Versionado de texto para Tareas semanales, mismo patrón ya probado en
-- Coordenadas (entusiasmo_coordenadas_versiones + entusiasmo_aportes.version_id):
-- permite que un participante reescriba el texto de una tarea sin perder el
-- texto anterior ni los comentarios que el admin le haya dejado ahí.
create table if not exists public.entusiasmo_tareas_versiones (
  id bigint generated always as identity primary key,
  tarea_id bigint not null references public.entusiasmo_tareas(id) on delete cascade,
  contenido text not null,
  created_at timestamptz not null default now()
);

alter table public.entusiasmo_tareas_versiones enable row level security;

create index if not exists entusiasmo_tareas_versiones_tarea_id_idx
  on public.entusiasmo_tareas_versiones (tarea_id);

-- Columna separada de entusiasmo_aportes.version_id (que apunta a
-- entusiasmo_coordenadas_versiones) porque un comentario de tarea nunca
-- puede confundirse con uno de coordenadas — cada FK apunta a su propia
-- tabla de versiones.
alter table public.entusiasmo_aportes
  add column if not exists tarea_version_id bigint
    references public.entusiasmo_tareas_versiones(id) on delete set null;
