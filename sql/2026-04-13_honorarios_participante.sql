create table if not exists public.honorarios_participante (
  id bigserial primary key,
  actividad_id bigint not null references public.actividades(id) on delete cascade,
  participante_email text not null,
  participante_nombre text,
  honorario_mensual numeric(12,2) not null,
  modalidad_pago text not null default 'mensual',
  moneda text not null default 'ARS',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actividad_id, participante_email)
);

create index if not exists honorarios_participante_email_idx
  on public.honorarios_participante (participante_email);

create index if not exists honorarios_participante_actividad_idx
  on public.honorarios_participante (actividad_id, activo);
