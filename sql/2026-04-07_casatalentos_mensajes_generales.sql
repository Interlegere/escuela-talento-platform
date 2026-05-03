create table if not exists public.casatalentos_mensajes (
  id bigserial primary key,
  parent_id bigint references public.casatalentos_mensajes(id) on delete cascade,
  asunto text,
  autor_nombre text not null,
  autor_email text,
  autor_rol text not null,
  contenido text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists casatalentos_mensajes_parent_id_idx
  on public.casatalentos_mensajes (parent_id, created_at);

create index if not exists casatalentos_mensajes_autor_email_idx
  on public.casatalentos_mensajes (autor_email);
