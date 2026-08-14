create table if not exists public.entusiasmo_coordenadas_versiones (
  id bigserial primary key,
  proyecto_id bigint not null references public.entusiasmo_proyectos(id) on delete cascade,
  campo text not null,
  contenido text not null,
  created_at timestamptz not null default now()
);

create index if not exists entusiasmo_coordenadas_versiones_proyecto_campo_idx
  on public.entusiasmo_coordenadas_versiones (proyecto_id, campo, created_at desc);
