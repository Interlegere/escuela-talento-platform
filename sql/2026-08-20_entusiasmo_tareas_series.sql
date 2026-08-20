-- Tareas semanales recurrentes ("todos los martes a las 19hs"). Una serie
-- define el patrón; cada semana se genera una ocurrencia real en
-- entusiasmo_tareas (así cada una se completa/edita de forma
-- independiente, como cualquier tarea).
create table if not exists entusiasmo_tareas_series (
  id bigint generated always as identity primary key,
  proyecto_id bigint not null references entusiasmo_proyectos(id) on delete cascade,
  contenido text not null,
  dia_semana integer not null, -- 0=domingo .. 6=sábado (Date#getUTCDay())
  hora text,
  prioridad text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table entusiasmo_tareas_series enable row level security;

alter table entusiasmo_tareas
  add column if not exists serie_id bigint references entusiasmo_tareas_series(id) on delete set null;

create index if not exists entusiasmo_tareas_serie_id_idx
  on entusiasmo_tareas (serie_id);
