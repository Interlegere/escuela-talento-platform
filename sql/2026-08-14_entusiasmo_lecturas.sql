-- Marca de "última vez que X leyó el espacio de Y" — sirve en dos
-- direcciones: admin viendo la actividad de un participante, y un
-- participante (o el propio admin) viendo sus propios aportes recibidos.
create table if not exists entusiasmo_lecturas (
  id bigint generated always as identity primary key,
  lector_email text not null,
  participante_email text not null,
  leido_at timestamptz not null default now(),
  unique (lector_email, participante_email)
);

alter table entusiasmo_lecturas enable row level security;
