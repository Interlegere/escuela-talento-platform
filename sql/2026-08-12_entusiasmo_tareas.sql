create table if not exists public.entusiasmo_tareas (
  id bigserial primary key,
  proyecto_id bigint not null references public.entusiasmo_proyectos(id) on delete cascade,
  contenido text not null,
  completada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entusiasmo_tareas_proyecto_idx
  on public.entusiasmo_tareas (proyecto_id);

alter table public.entusiasmo_tareas enable row level security;
