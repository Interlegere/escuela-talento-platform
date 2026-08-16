-- Última vez que cada campo de Coordenadas cambió de valor (incluye la
-- primera vez que se completa, a diferencia de entusiasmo_coordenadas_versiones
-- que solo archiva cuando había un valor anterior no vacío). Sirve
-- exclusivamente para los puntitos de "nuevo" por campo del admin — no es
-- una tabla de historial visible para el participante.
create table if not exists entusiasmo_campos_actividad (
  id bigint generated always as identity primary key,
  proyecto_id bigint not null references entusiasmo_proyectos(id) on delete cascade,
  campo text not null,
  modificado_at timestamptz not null default now(),
  unique (proyecto_id, campo)
);

alter table entusiasmo_campos_actividad enable row level security;
