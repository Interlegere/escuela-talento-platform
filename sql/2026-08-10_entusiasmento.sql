create table if not exists public.entusiasmo_proyectos (
  id bigserial primary key,
  participante_email text not null unique,
  participante_nombre text,
  que text,
  para_que text,
  problema_solucion text,
  resultado_semanal text,
  resultado_mensual text,
  resultado_trimestral text,
  resultado_anual text,
  habilidad_a_desarrollar text,
  que_te_entusiasma text,
  pitch_contenido text,
  pitch_storage_path text,
  pitch_mime_type text,
  pitch_actualizado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entusiasmo_producciones (
  id bigserial primary key,
  proyecto_id bigint not null references public.entusiasmo_proyectos(id) on delete cascade,
  categoria text not null,
  tipo text not null,
  titulo text,
  contenido text,
  storage_path text,
  mime_type text,
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entusiasmo_aportes (
  id bigserial primary key,
  proyecto_id bigint not null references public.entusiasmo_proyectos(id) on delete cascade,
  produccion_id bigint references public.entusiasmo_producciones(id) on delete cascade,
  autor_nombre text,
  autor_email text,
  contenido text not null,
  created_at timestamptz not null default now()
);

create index if not exists entusiasmo_producciones_proyecto_idx
  on public.entusiasmo_producciones (proyecto_id);

create index if not exists entusiasmo_producciones_visible_idx
  on public.entusiasmo_producciones (visible)
  where visible = true;

create index if not exists entusiasmo_aportes_proyecto_idx
  on public.entusiasmo_aportes (proyecto_id);

create index if not exists entusiasmo_aportes_produccion_idx
  on public.entusiasmo_aportes (produccion_id);

alter table public.entusiasmo_proyectos enable row level security;
alter table public.entusiasmo_producciones enable row level security;
alter table public.entusiasmo_aportes enable row level security;
