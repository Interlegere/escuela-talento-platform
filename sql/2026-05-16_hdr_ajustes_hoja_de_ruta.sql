alter table if exists public.hdr_coordenadas
  add column if not exists descripcion_html text;

create table if not exists public.hdr_notas_personales (
  id uuid primary key default gen_random_uuid(),
  actividad_slug text not null,
  participante_email text not null,
  contenido text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hdr_notas_personales_actividad_slug_check
    check (actividad_slug in ('casatalentos', 'conectando-sentidos', 'mentorias', 'terapia')),
  unique (actividad_slug, participante_email)
);

create index if not exists hdr_notas_personales_actividad_email_idx
  on public.hdr_notas_personales (actividad_slug, participante_email);

drop trigger if exists set_hdr_notas_personales_updated_at on public.hdr_notas_personales;
create trigger set_hdr_notas_personales_updated_at
before update on public.hdr_notas_personales
for each row execute function public.set_updated_at();

alter table if exists public.hdr_notas_personales enable row level security;
revoke all privileges on table public.hdr_notas_personales from anon, authenticated;
