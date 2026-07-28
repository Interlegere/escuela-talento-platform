create table if not exists public.comunicaciones_programadas (
  id bigserial primary key,
  nombre text not null,
  tipo text not null,
  actividad_slug text,
  asunto text not null,
  contenido text not null,
  segmento text not null,
  filtro_pago_pendiente text,
  emails_manual text,
  destinatarios_seleccionados jsonb not null default '[]'::jsonb,
  recurrencia text not null,
  fecha_una_vez date,
  dia_semana int,
  dia_mes int,
  intervalo_dias int,
  hora text not null,
  modo_disparo text not null default 'requiere_aprobacion',
  activo boolean not null default true,
  proxima_ejecucion timestamptz not null,
  ultima_ejecucion_at timestamptz,
  pendiente_aprobacion boolean not null default false,
  creado_por_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comunicaciones_programadas_proxima_ejecucion_idx
  on public.comunicaciones_programadas (proxima_ejecucion)
  where activo = true;

create index if not exists comunicaciones_programadas_activo_idx
  on public.comunicaciones_programadas (activo);
