create table if not exists public.comunicacion_recibidos (
  id bigserial primary key,
  resend_email_id text unique,
  remitente_email text not null,
  remitente_nombre text,
  destinatario_email text,
  asunto text,
  texto text,
  html text,
  participante_email_vinculado text,
  leido boolean not null default false,
  respondido boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  recibido_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists comunicacion_recibidos_remitente_idx
  on public.comunicacion_recibidos (remitente_email);

create index if not exists comunicacion_recibidos_recibido_at_idx
  on public.comunicacion_recibidos (recibido_at desc);

create index if not exists comunicacion_recibidos_leido_idx
  on public.comunicacion_recibidos (leido);
