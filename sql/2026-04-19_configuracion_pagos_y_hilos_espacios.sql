create table if not exists public.configuracion_plataforma (
  clave text primary key,
  valor_texto text,
  updated_at timestamptz not null default now()
);

insert into public.configuracion_plataforma (clave, valor_texto)
values ('mercado_pago_recargo_porcentaje', '0')
on conflict (clave) do nothing;

alter table public.espacios_mensajes
  add column if not exists parent_id bigint references public.espacios_mensajes(id) on delete cascade;

create index if not exists espacios_mensajes_parent_id_idx
  on public.espacios_mensajes (parent_id, created_at);
